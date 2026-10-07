import { z } from "zod";

import {
  normalizeEmail,
  PLANS,
  type BillingStatus,
  type CheckoutResponse,
  type PaymentResult,
  type PlanId,
  type ReceiptsResponse,
} from "../../../../contracts";
import { createRouter } from "../../lib/app";
import { randomToken } from "../../lib/crypto";
import { ApiError } from "../../lib/errors";
import { parseJson } from "../../lib/validation";
import { requireSession } from "../auth/sessions";
import { requireActive } from "../discovery/visibility";

import { activateSubscription, billingStatus } from "./entitlement";
import { fakeCheckoutDonePage, fakeCheckoutPage } from "./fakeCheckout";

/** Where a checkout may send the member back to: the app (dev or installed) or a local web build. */
function allowedReturnUrl(url: string): boolean {
  return /^(icecream|exps?):\/\//.test(url) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url);
}

function withParams(url: string, params: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  return `${url}${url.includes("?") ? "&" : "?"}${query}`;
}

function fakeCheckoutEnabled(env: Env) {
  return env.BILLING_PROVIDER === "fake" && env.ENVIRONMENT !== "production";
}

type PaymentRow = { reference: string; user_id: string; plan: PlanId; amount_kobo: number; status: "pending" | "paid" | "failed" };

/** Marks a payment paid and starts or extends the subscription, once. */
async function settlePayment(db: D1Database, payment: PaymentRow, provider: string) {
  if (payment.status === "paid") return;
  const now = Date.now();
  await db.batch([
    db.prepare("UPDATE payments SET status = 'paid', paid_at = ? WHERE reference = ? AND status = 'pending'").bind(now, payment.reference),
    activateSubscription(db, payment.user_id, payment.plan, provider, now),
  ]);
}

export const billingRoutes = createRouter()
  // The test checkout page is opened in a browser without the app's session; the reference is the secret.
  .get("/fake-checkout/:reference", async (c) => {
    if (!fakeCheckoutEnabled(c.env)) throw new ApiError(404, "not_found", "Not found.");
    const payment = await c.env.DB.prepare("SELECT plan, amount_kobo, status FROM payments WHERE reference = ?")
      .bind(c.req.param("reference"))
      .first<{ plan: PlanId; amount_kobo: number; status: string }>();
    const returnUrl = c.req.query("return") ?? "";
    if (!payment || !allowedReturnUrl(returnUrl)) throw new ApiError(404, "not_found", "Not found.");
    return c.html(
      fakeCheckoutPage({
        reference: c.req.param("reference"),
        planLabel: PLANS[payment.plan].label,
        amountNaira: payment.amount_kobo / 100,
        returnUrl,
      }),
    );
  })

  .post("/fake-checkout/:reference/:outcome", async (c) => {
    if (!fakeCheckoutEnabled(c.env)) throw new ApiError(404, "not_found", "Not found.");
    const reference = c.req.param("reference");
    const returnUrl = c.req.query("return") ?? "";
    const payment = await c.env.DB.prepare("SELECT * FROM payments WHERE reference = ?")
      .bind(reference)
      .first<PaymentRow>();
    if (!payment) throw new ApiError(404, "not_found", "Payment not found.");
    if (!allowedReturnUrl(returnUrl)) throw new ApiError(400, "invalid_request", "Return address not allowed.");

    const paid = c.req.param("outcome") === "pay";
    if (paid) await settlePayment(c.env.DB, payment, "fake");
    const backUrl = withParams(returnUrl, { reference, status: paid ? "paid" : "cancelled" });
    return c.html(fakeCheckoutDonePage({ paid, backUrl }));
  });

export const billingMemberRoutes = createRouter()
  .use(requireSession)
  .use(requireActive)

  .get("/status", async (c) => c.json<BillingStatus>(await billingStatus(c.env.DB, c.get("userId"))))

  /** Starts a payment for a plan and returns the provider's checkout page to open in the browser. */
  .post("/checkout", async (c) => {
    const userId = c.get("userId");
    const body = await parseJson(
      c,
      z.object({ plan: z.enum(["weekly", "monthly", "yearly"]), email: z.string().optional(), returnUrl: z.string() }),
    );
    if (!allowedReturnUrl(body.returnUrl)) throw new ApiError(400, "invalid_request", "returnUrl is not allowed.");

    const user = await c.env.DB.prepare("SELECT email FROM users WHERE id = ?").bind(userId).first<{ email: string | null }>();
    const email = user?.email ?? (body.email ? normalizeEmail(body.email) : undefined);
    if (!email) throw new ApiError(400, "email_required", "Enter your email address so we can send your receipt.");

    const plan = PLANS[body.plan];
    const reference = `ice_${randomToken().slice(0, 24)}`;
    await c.env.DB.prepare(
      `INSERT INTO payments (reference, user_id, plan, amount_kobo, status, provider, email, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
    )
      .bind(reference, userId, body.plan, plan.priceNaira * 100, c.env.BILLING_PROVIDER, email, Date.now())
      .run();

    if (fakeCheckoutEnabled(c.env)) {
      const origin = new URL(c.req.url).origin;
      const checkoutUrl = `${origin}/v1/billing/fake-checkout/${reference}?return=${encodeURIComponent(body.returnUrl)}`;
      return c.json<CheckoutResponse>({ reference, checkoutUrl });
    }
    // Paystack is connected in the next step (BILLING_PROVIDER=paystack).
    throw new ApiError(503, "payments_unavailable", "Payments aren't available yet. Please try again later.");
  })

  /** After the checkout closes: has this payment gone through? */
  .post("/verify", async (c) => {
    const userId = c.get("userId");
    const { reference } = await parseJson(c, z.object({ reference: z.string() }));
    const payment = await c.env.DB.prepare("SELECT * FROM payments WHERE reference = ? AND user_id = ?")
      .bind(reference, userId)
      .first<PaymentRow>();
    if (!payment) throw new ApiError(404, "not_found", "Payment not found.");
    const fresh = await c.env.DB.prepare("SELECT status FROM payments WHERE reference = ?").bind(reference).first<{ status: PaymentRow["status"] }>();
    return c.json<PaymentResult>({ reference, status: fresh!.status, billing: await billingStatus(c.env.DB, userId) });
  })

  /** Stops renewal. Messaging keeps working until the end of the period already paid for (PRD 4.7). */
  .post("/cancel", async (c) => {
    const userId = c.get("userId");
    await c.env.DB.prepare("UPDATE subscriptions SET status = 'cancelled', updated_at = ? WHERE user_id = ?")
      .bind(Date.now(), userId)
      .run();
    return c.json<BillingStatus>(await billingStatus(c.env.DB, userId));
  })

  .get("/receipts", async (c) => {
    const { results } = await c.env.DB.prepare(
      `SELECT reference, plan, amount_kobo, paid_at FROM payments WHERE user_id = ? AND status = 'paid' ORDER BY paid_at DESC`,
    )
      .bind(c.get("userId"))
      .all<{ reference: string; plan: PlanId; amount_kobo: number; paid_at: number }>();
    return c.json<ReceiptsResponse>({
      receipts: results.map((row) => ({ reference: row.reference, plan: row.plan, amountNaira: row.amount_kobo / 100, paidAt: row.paid_at })),
    });
  });

