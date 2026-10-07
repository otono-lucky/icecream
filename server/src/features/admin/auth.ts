import type { MiddlewareHandler } from "hono";
import { z } from "zod";

import { normalizeEmail, type Admin, type AdminSignInResponse } from "../../../../contracts";
import { createRouter, type AppEnv } from "../../lib/app";
import { randomToken, sha256Hex } from "../../lib/crypto";
import { ApiError, unauthorized } from "../../lib/errors";
import { parseJson } from "../../lib/validation";
import { consumeOtp, issueOtp, OTP_RESEND_AFTER_SECONDS } from "../auth/otp";
import { bearerToken } from "../auth/sessions";

// Shorter than a member's: admin sessions can see everyone's details.
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export type AdminEnv = AppEnv & { Variables: { admin: Admin } };

type AdminRow = { id: string; email: string; name: string };

const findAdmin = (db: D1Database, email: string) =>
  db.prepare("SELECT id, email, name FROM admins WHERE email = ? AND disabled_at IS NULL").bind(email).first<AdminRow>();

function requireEmail(input: string): string {
  const email = normalizeEmail(input);
  if (!email) throw new ApiError(400, "invalid_email", "Enter a valid email address.");
  return email;
}

/** Requires a signed-in, not disabled admin, and sets `admin`. */
export const requireAdmin: MiddlewareHandler<AdminEnv> = async (c, next) => {
  const token = bearerToken(c.req.header("Authorization"));
  if (!token) throw unauthorized();
  const admin = await c.env.DB.prepare(
    `SELECT a.id, a.email, a.name FROM admin_sessions s JOIN admins a ON a.id = s.admin_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND a.disabled_at IS NULL`,
  )
    .bind(await sha256Hex(token), Date.now())
    .first<AdminRow>();
  if (!admin) throw unauthorized();
  c.set("admin", admin);
  await next();
};

/** Signing in to the admin website. Mounted at /v1/admin/auth. */
export const adminAuthRoutes = createRouter()
  /**
   * Emails a code if the address belongs to an admin. Answers the same either way, so the page
   * can't be used to find out who the admins are.
   */
  .post("/request", async (c) => {
    const email = requireEmail((await parseJson(c, z.object({ email: z.string() }))).email);
    if (await findAdmin(c.env.DB, email)) await issueOtp(c.env, email, "admin");
    return c.json({ resendAfterSeconds: OTP_RESEND_AFTER_SECONDS });
  })

  .post("/verify", async (c) => {
    const body = await parseJson(c, z.object({ email: z.string(), code: z.string().regex(/^\d{6}$/) }));
    const email = requireEmail(body.email);
    // Someone who isn't an admin never had a code sent, so this fails like an expired code.
    await consumeOtp(c.env, email, body.code, "admin");
    const admin = await findAdmin(c.env.DB, email);
    if (!admin) throw new ApiError(400, "code_expired", "That code has expired. Request a new one.");

    const token = randomToken();
    const now = Date.now();
    await c.env.DB.prepare("INSERT INTO admin_sessions (token_hash, admin_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
      .bind(await sha256Hex(token), admin.id, now + ADMIN_SESSION_TTL_MS, now)
      .run();
    return c.json<AdminSignInResponse>({ token, admin });
  })

  .post("/sign-out", async (c) => {
    const token = bearerToken(c.req.header("Authorization"));
    if (token) await c.env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
    return c.body(null, 204);
  });
