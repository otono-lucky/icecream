import type { MiddlewareHandler } from "hono";

import type { AppEnv } from "../../lib/app";
import { ApiError } from "../../lib/errors";

export type Viewer = { id: string; gender: "woman" | "man"; city: string };

export type ViewerEnv = AppEnv & { Variables: { viewer: Viewer } };

/** Browsing, interest and chat are for verified members only (PRD 3.1). Sets `viewer`. */
export const requireActive: MiddlewareHandler<ViewerEnv> = async (c, next) => {
  const viewer = await c.env.DB.prepare("SELECT id, gender, city, status FROM users WHERE id = ?")
    .bind(c.get("userId"))
    .first<Viewer & { status: string }>();
  if (!viewer || viewer.status !== "active") {
    throw new ApiError(403, "not_verified", "You can browse once your verification passes.");
  }
  c.set("viewer", viewer);
  await next();
};

/**
 * SQL condition (on users `u`) for "the viewer may see this member": verified, the other gender,
 * not themselves, at least one photo, and no block either way. Bind with `visibleBinds(viewer)`.
 */
export const VISIBLE_MEMBER = `u.status = 'active' AND u.gender = ? AND u.id != ?
  AND EXISTS (SELECT 1 FROM photos p WHERE p.user_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM blocks b
                  WHERE (b.blocker_id = ? AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = ?))`;

export const visibleBinds = (viewer: Viewer) => [
  viewer.gender === "man" ? "woman" : "man",
  viewer.id,
  viewer.id,
  viewer.id,
];
