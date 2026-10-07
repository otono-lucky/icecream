import { z } from "zod";

import { createRouter } from "../../lib/app";
import { randomId } from "../../lib/crypto";
import { ApiError } from "../../lib/errors";
import { parseJson } from "../../lib/validation";
import { requireSession } from "../auth/sessions";
import { requireActive } from "../discovery/visibility";

/**
 * Report and block (PRD 3.8, 4.4). Mounted under /v1/members/:id. Neither is ever shown to the
 * other member. Reports go to the admin safety queue.
 */
export const safetyRoutes = createRouter()
  .use(requireSession)
  .use(requireActive)

  .post("/:id/block", async (c) => {
    const viewer = c.get("viewer");
    const memberId = c.req.param("id");
    if (memberId === viewer.id) throw new ApiError(400, "invalid_request", "You can't block yourself.");
    const exists = await c.env.DB.prepare("SELECT 1 FROM users WHERE id = ?").bind(memberId).first();
    if (!exists) throw new ApiError(404, "not_found", "Member not found.");
    await c.env.DB.prepare(
      "INSERT INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
    )
      .bind(viewer.id, memberId, Date.now())
      .run();
    return c.body(null, 204);
  })

  .post("/:id/report", async (c) => {
    const viewer = c.get("viewer");
    const memberId = c.req.param("id");
    const body = await parseJson(
      c,
      z.object({
        reason: z.enum(["fraud", "misrepresentation", "harassment", "other"]),
        details: z.string().trim().max(2000).optional(),
      }),
    );
    if (memberId === viewer.id) throw new ApiError(400, "invalid_request", "You can't report yourself.");
    const exists = await c.env.DB.prepare("SELECT 1 FROM users WHERE id = ?").bind(memberId).first();
    if (!exists) throw new ApiError(404, "not_found", "Member not found.");
    await c.env.DB.prepare(
      "INSERT INTO reports (id, reporter_id, reported_id, reason, details, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(randomId(), viewer.id, memberId, body.reason, body.details || null, Date.now())
      .run();
    return c.body(null, 204);
  });
