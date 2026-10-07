import type { MiddlewareHandler } from "hono";

import type { AppEnv } from "../../lib/app";
import { randomToken, sha256Hex } from "../../lib/crypto";
import { unauthorized } from "../../lib/errors";

const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export async function createSession(env: Env, userId: string, now = Date.now()): Promise<string> {
  const token = randomToken();
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256Hex(token), userId, now + SESSION_TTL_MS, now)
    .run();
  return token;
}

export async function deleteSession(env: Env, token: string): Promise<void> {
  await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
}

export function bearerToken(header: string | undefined): string | undefined {
  const match = /^Bearer (.+)$/.exec(header ?? "");
  return match?.[1];
}

/** Requires a valid session and sets `userId`. Suspended members are signed out. */
export const requireSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = bearerToken(c.req.header("Authorization"));
  if (!token) throw unauthorized();

  const session = await c.env.DB.prepare(
    `SELECT s.user_id FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND u.status != 'suspended'`,
  )
    .bind(await sha256Hex(token), Date.now())
    .first<{ user_id: string }>();
  if (!session) throw unauthorized();

  c.set("userId", session.user_id);
  await next();
};
