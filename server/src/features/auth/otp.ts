import { randomId, randomOtp, safeEqual, sha256Hex } from "../../lib/crypto";
import { ApiError } from "../../lib/errors";

import { sendOtpEmail } from "./email";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_AFTER_SECONDS = 60;
export const OTP_MAX_PER_HOUR = 5;

// Codes are stored hashed. The "email" channel is kept in the hash and the table from when phone sign-in existed.
const CHANNEL = "email";
const hashCode = (env: Env, to: string, code: string) => sha256Hex(`${env.OTP_PEPPER}:${CHANNEL}:${to}:${code}`);

/**
 * A new random code, except outside production when emails are only printed to the server log
 * (EMAIL_PROVIDER "console"): then OTP_FIXED_CODE, if set, so local sign-in and tests don't need the
 * log. A code that is really sent, over SMTP, is always random.
 */
export function codeFor(env: Env): string {
  const fixed = env.ENVIRONMENT !== "production" && env.EMAIL_PROVIDER === "console" && env.OTP_FIXED_CODE;
  return fixed || randomOtp();
}

/**
 * Whose sign-in a code is for. Admin codes are stored apart from member codes, so someone who is both
 * gets separate codes and separate rate limits for each.
 */
export type OtpScope = "member" | "admin";

const storedAs = (scope: OtpScope, email: string) => (scope === "admin" ? `admin:${email}` : email);

/** Emails a new code to a normalised email address. */
export async function issueOtp(env: Env, email: string, scope: OtpScope = "member", now = Date.now()): Promise<void> {
  const to = storedAs(scope, email);
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS count, MAX(created_at) AS latest FROM otp_challenges WHERE destination = ? AND created_at > ?",
  )
    .bind(to, now - 60 * 60 * 1000)
    .first<{ count: number; latest: number | null }>();

  if (recent?.latest && now - recent.latest < OTP_RESEND_AFTER_SECONDS * 1000) {
    throw new ApiError(429, "resend_too_soon", "Please wait a minute before requesting another code.");
  }
  if ((recent?.count ?? 0) >= OTP_MAX_PER_HOUR) {
    throw new ApiError(429, "too_many_codes", "Too many codes requested. Try again in an hour.");
  }

  const code = codeFor(env);
  // Deliver first: if sending fails, no challenge is stored, so the member can retry straight away
  // instead of waiting out the resend cooldown for a code that never arrived.
  await sendOtpEmail(env, email, code);
  await env.DB.prepare(
    "INSERT INTO otp_challenges (id, channel, destination, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(randomId(), CHANNEL, to, await hashCode(env, to, code), now + OTP_TTL_MS, now)
    .run();
}

/** Checks the code against the latest live challenge for the destination, and consumes it on success. */
export async function consumeOtp(
  env: Env,
  email: string,
  code: string,
  scope: OtpScope = "member",
  now = Date.now(),
): Promise<void> {
  const to = storedAs(scope, email);
  const challenge = await env.DB.prepare(
    `SELECT id, code_hash, attempts FROM otp_challenges
     WHERE channel = ? AND destination = ? AND consumed_at IS NULL AND expires_at > ?
     ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(CHANNEL, to, now)
    .first<{ id: string; code_hash: string; attempts: number }>();

  if (!challenge) {
    throw new ApiError(400, "code_expired", "That code has expired. Request a new one.");
  }
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    throw new ApiError(429, "too_many_attempts", "Too many wrong attempts. Request a new code.");
  }

  await env.DB.prepare("UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = ?").bind(challenge.id).run();
  if (!safeEqual(challenge.code_hash, await hashCode(env, to, code))) {
    throw new ApiError(400, "invalid_code", "That code isn't right. Check your email and try again.");
  }
  await env.DB.prepare("UPDATE otp_challenges SET consumed_at = ? WHERE id = ?").bind(now, challenge.id).run();
}
