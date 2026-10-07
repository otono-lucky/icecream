import { z } from "zod";

import {
  normalizeEmail,
  type RequestOtpResponse,
  type VerifyOtpResponse,
} from "../../../../contracts";
import { createRouter } from "../../lib/app";
import { randomId } from "../../lib/crypto";
import { ApiError } from "../../lib/errors";
import { parseJson } from "../../lib/validation";
import { loadMe } from "../me/me";

import { consumeOtp, issueOtp, OTP_RESEND_AFTER_SECONDS } from "./otp";
import { bearerToken, createSession, deleteSession, requireSession } from "./sessions";

const destinationSchema = z.object({ channel: z.string(), to: z.string() });

/**
 * Sign-in is by email only. Rejects any other channel (e.g. "sms" from an old version of the app)
 * with a message for the member, and returns the normalised address.
 */
function requireEmail(channel: string, input: string): string {
  if (channel !== "email") throw new ApiError(400, "email_only", "Sign in with your email address.");
  const email = normalizeEmail(input);
  if (!email) throw new ApiError(400, "invalid_email", "Enter a valid email address, like ada@example.com.");
  return email;
}

export const authRoutes = createRouter()
  .post("/otp/request", async (c) => {
    const body = await parseJson(c, destinationSchema);
    const to = requireEmail(body.channel, body.to);
    await issueOtp(c.env, to);
    return c.json<RequestOtpResponse>({ channel: "email", to, resendAfterSeconds: OTP_RESEND_AFTER_SECONDS });
  })
  .post("/otp/verify", async (c) => {
    const body = await parseJson(c, destinationSchema.extend({ code: z.string().regex(/^\d{6}$/) }));
    const to = requireEmail(body.channel, body.to);
    await consumeOtp(c.env, to, body.code);

    const now = Date.now();
    await c.env.DB.prepare("INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (email) DO NOTHING")
      .bind(randomId(), to, now, now)
      .run();
    const user = await c.env.DB.prepare("SELECT id, status FROM users WHERE email = ?")
      .bind(to)
      .first<{ id: string; status: string }>();
    if (!user) throw new Error("User missing after upsert.");
    if (user.status === "suspended") {
      throw new ApiError(403, "account_suspended", "This account has been suspended.");
    }

    const token = await createSession(c.env, user.id, now);
    return c.json<VerifyOtpResponse>({ token, me: await loadMe(c.env.DB, user.id) });
  })
  .post("/sign-out", requireSession, async (c) => {
    const token = bearerToken(c.req.header("Authorization"));
    if (token) await deleteSession(c.env, token);
    return c.body(null, 204);
  });
