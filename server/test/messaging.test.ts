import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import type {
  BillingStatus,
  ChatResponse,
  CheckoutResponse,
  ConversationsResponse,
  PaymentResult,
  ReceiptsResponse,
  TodayResponse,
} from "../../contracts";

import { activeMember, call, expectError } from "./helpers";

const uniqueCity = () => `Testville ${Math.random().toString(36).slice(2, 8)}`;
const RETURN_URL = "icecream://billing-return";

const send = (token: string, memberId: string, body: string) =>
  call(`/v1/chats/${memberId}/messages`, { token, json: { body } });

async function status(token: string): Promise<BillingStatus> {
  return (await (await call("/v1/billing/status", { token })).json()) as BillingStatus;
}

/** Runs the test checkout to the end, as the member tapping "Pay" would. */
async function payFor(token: string, plan: "weekly" | "monthly" | "yearly", email = "pay@example.com") {
  const checkout = (await (
    await call("/v1/billing/checkout", { token, json: { plan, email, returnUrl: RETURN_URL } })
  ).json()) as CheckoutResponse;
  const url = new URL(checkout.checkoutUrl);
  expect((await call(`${url.pathname}${url.search}`)).status).toBe(200);
  const pay = await call(`/v1/billing/fake-checkout/${checkout.reference}/pay${url.search}`, { method: "POST" });
  expect(pay.status).toBe(200);
  const page = await pay.text();
  expect(page).toContain("Payment complete");
  // A tappable link back into the app (Android won't follow an automatic redirect into an app).
  expect(page).toContain(`href="${RETURN_URL}?reference=${checkout.reference}&amp;status=paid"`);
  return checkout.reference;
}

describe("messaging access", () => {
  it("lets women message free at launch, and asks men to choose a plan", async () => {
    const city = uniqueCity();
    const woman = await activeMember({ firstName: "Adanna", gender: "woman", city });
    const man = await activeMember({ firstName: "Chuks", gender: "man", city });

    expect(await status(woman.token)).toMatchObject({ canMessage: true, why: "free_at_launch" });
    expect(await status(man.token)).toMatchObject({ canMessage: false, why: "none", subscription: null });
    await expectError(await send(man.token, woman.id, "Hello"), 402, "subscription_required");

    // She can start the conversation; he can read it but not reply yet.
    expect((await send(woman.token, man.id, "Good evening")).status).toBe(201);
    const chat = (await (await call(`/v1/chats/${woman.id}`, { token: man.token })).json()) as ChatResponse;
    expect(chat.messages.map((m) => m.body)).toEqual(["Good evening"]);
    expect(chat.canSend).toBe(false);
  });

  it("unlocks messaging after paying, for the length of the plan, and keeps a receipt", async () => {
    const city = uniqueCity();
    const woman = await activeMember({ firstName: "Ugo", gender: "woman", city });
    const man = await activeMember({ firstName: "Ike", gender: "man", city });

    const reference = await payFor(man.token, "monthly");
    const verified = (await (await call("/v1/billing/verify", { token: man.token, json: { reference } })).json()) as PaymentResult;
    expect(verified.status).toBe("paid");
    expect(verified.billing).toMatchObject({ canMessage: true, why: "subscribed", subscription: { plan: "monthly", status: "active" } });
    const days = (verified.billing.subscription!.currentPeriodEnd - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);

    expect((await send(man.token, woman.id, "Hello Ugo")).status).toBe(201);
    const receipts = (await (await call("/v1/billing/receipts", { token: man.token })).json()) as ReceiptsResponse;
    expect(receipts.receipts).toMatchObject([{ reference, plan: "monthly", amountNaira: 5000 }]);
  });

  it("extends from the end of the current period when paying again", async () => {
    const man = await activeMember({ firstName: "Seyi", gender: "man", city: uniqueCity() });
    await payFor(man.token, "weekly");
    const first = (await status(man.token)).subscription!.currentPeriodEnd;
    await payFor(man.token, "weekly");
    const second = (await status(man.token)).subscription!.currentPeriodEnd;
    expect(Math.round((second - first) / 86_400_000)).toBe(7);
  });

  it("needs an email for the receipt when an older account signed up by phone", async () => {
    const man = await activeMember({ firstName: "Bayo", gender: "man", city: uniqueCity() });
    // Phone sign-in has gone, but accounts made with it before have a phone and no email.
    await env.DB.prepare("UPDATE users SET phone = ?, email = NULL WHERE id = ?").bind(`+234803${Date.now() % 1e7}`, man.id).run();
    await expectError(
      await call("/v1/billing/checkout", { token: man.token, json: { plan: "weekly", returnUrl: RETURN_URL } }),
      400,
      "email_required",
    );
    await expectError(
      await call("/v1/billing/checkout", {
        token: man.token,
        json: { plan: "weekly", email: "b@example.com", returnUrl: "https://evil.example/steal" },
      }),
      400,
      "invalid_request",
    );
  });

  it("cancelling stops renewal but keeps messaging until the paid period ends", async () => {
    const man = await activeMember({ firstName: "Wale", gender: "man", city: uniqueCity() });
    await payFor(man.token, "yearly");
    const after = (await (await call("/v1/billing/cancel", { method: "POST", token: man.token })).json()) as BillingStatus;
    expect(after).toMatchObject({ canMessage: true, subscription: { plan: "yearly", status: "cancelled" } });
  });

  it("a cancelled test payment doesn't unlock anything", async () => {
    const man = await activeMember({ firstName: "Gbenga", gender: "man", city: uniqueCity() });
    const checkout = (await (
      await call("/v1/billing/checkout", { token: man.token, json: { plan: "weekly", email: "g@example.com", returnUrl: RETURN_URL } })
    ).json()) as CheckoutResponse;
    const cancel = await call(`/v1/billing/fake-checkout/${checkout.reference}/cancel?return=${encodeURIComponent(RETURN_URL)}`, { method: "POST" });
    expect(await cancel.text()).toContain("status=cancelled");
    expect((await status(man.token)).canMessage).toBe(false);
  });
});

describe("conversations", () => {
  it("lists conversations newest first, with unread counts that clear when opened", async () => {
    const city = uniqueCity();
    const woman = await activeMember({ firstName: "Folake", gender: "woman", city });
    const otherWoman = await activeMember({ firstName: "Kemi", gender: "woman", city });
    const man = await activeMember({ firstName: "Dele", gender: "man", city });

    await send(woman.token, man.id, "Hi Dele");
    await send(woman.token, man.id, "Are you free Saturday?");
    await send(otherWoman.token, man.id, "Hello from Kemi");

    const list = (await (await call("/v1/chats", { token: man.token })).json()) as ConversationsResponse;
    expect(list.conversations.map((c) => c.member.firstName)).toEqual(["Kemi", "Folake"]);
    expect(list.conversations[1]).toMatchObject({ unread: 2, lastMessage: { text: "Are you free Saturday?", fromMe: false } });

    await call(`/v1/chats/${woman.id}`, { token: man.token });
    const after = (await (await call("/v1/chats", { token: man.token })).json()) as ConversationsResponse;
    expect(after.conversations.find((c) => c.member.id === woman.id)!.unread).toBe(0);
  });

  it("can message anyone visible, interest or not, but not members of the same gender", async () => {
    const city = uniqueCity();
    const woman = await activeMember({ firstName: "Lola", gender: "woman", city });
    const otherWoman = await activeMember({ firstName: "Dupe", gender: "woman", city });
    expect((await send(woman.token, otherWoman.id, "Hi")).status).toBe(404);
    await expectError(await send(woman.token, otherWoman.id, "  "), 404, "not_found");
  });

  it("rejects empty and over-long messages", async () => {
    const city = uniqueCity();
    const woman = await activeMember({ firstName: "Tobi", gender: "woman", city });
    const man = await activeMember({ firstName: "Jide", gender: "man", city });
    await expectError(await send(woman.token, man.id, "   "), 400, "invalid_request");
    await expectError(await send(woman.token, man.id, "x".repeat(2001)), 400, "invalid_request");
  });
});

describe("block and report", () => {
  it("blocking hides both members from each other everywhere, without telling them", async () => {
    const city = uniqueCity();
    const woman = await activeMember({ firstName: "Mojisola", gender: "woman", city });
    const man = await activeMember({ firstName: "Rotimi", gender: "man", city });
    await send(woman.token, man.id, "Hello");

    expect((await call(`/v1/members/${man.id}/block`, { method: "POST", token: woman.token })).status).toBe(204);

    await expectError(await call(`/v1/members/${woman.id}`, { token: man.token }), 404, "not_found");
    await expectError(await call(`/v1/members/${man.id}`, { token: woman.token }), 404, "not_found");
    await expectError(await send(woman.token, man.id, "Still there?"), 404, "not_found");
    const his = (await (await call("/v1/chats", { token: man.token })).json()) as ConversationsResponse;
    expect(his.conversations.some((c) => c.member.id === woman.id)).toBe(false);
    const today = (await (await call("/v1/discovery/today", { token: man.token })).json()) as TodayResponse;
    expect(today.introductions.some((card) => card.id === woman.id)).toBe(false);
  });

  it("files a report for the safety team", async () => {
    const city = uniqueCity();
    const woman = await activeMember({ firstName: "Yetunde", gender: "woman", city });
    const man = await activeMember({ firstName: "Kola", gender: "man", city });
    expect(
      (await call(`/v1/members/${man.id}/report`, { token: woman.token, json: { reason: "fraud", details: "Asked for money" } })).status,
    ).toBe(204);
    await expectError(
      await call(`/v1/members/${man.id}/report`, { token: woman.token, json: { reason: "rude" } }),
      400,
      "invalid_request",
    );
  });
});
