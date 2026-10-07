import { createRouter } from "../../lib/app";
import { randomId } from "../../lib/crypto";
import { ApiError } from "../../lib/errors";
import { readForm, requireImage, storeImage } from "../../lib/media";
import { requireSession } from "../auth/sessions";
import { assertCanEdit, assertReached, loadMe } from "../me/me";

const DOCUMENT_TYPES = new Set(["nin", "drivers_licence", "passport", "voters_card"]);

async function insertVerification(
  env: Env,
  userId: string,
  kind: "liveness" | "government_id",
  file: File,
  documentType: string | null,
) {
  const id = randomId();
  const key = `users/${userId}/verifications/${id}`;
  await storeImage(env.MEDIA, key, file);
  return env.DB.prepare(
    `INSERT INTO verifications (id, user_id, kind, document_type, object_key, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(id, userId, kind, documentType, key, Date.now());
}

export const verificationRoutes = createRouter()
  .use(requireSession)

  /**
   * Liveness check. For the MVP this is a live selfie taken in the app and compared with the
   * member's photos by a human reviewer; an automated liveness vendor can replace the review later.
   */
  .post("/liveness", async (c) => {
    const userId = c.get("userId");
    const me = await loadMe(c.env.DB, userId);
    assertReached(me, "liveness");

    const file = requireImage(await readForm(c.req.raw), "selfie");
    await (await insertVerification(c.env, userId, "liveness", file, null)).run();
    return c.json(await loadMe(c.env.DB, userId), 201);
  })

  /** Optional government ID for the verified badge. Allowed during onboarding or any time after. */
  .post("/government-id", async (c) => {
    const userId = c.get("userId");
    const me = await loadMe(c.env.DB, userId);
    assertCanEdit(me);
    if (me.user.status === "onboarding" && !["id-verification", "pending"].includes(me.onboarding.nextStep)) {
      throw new ApiError(409, "step_out_of_order", "Finish the earlier steps first.");
    }
    if (["pending", "passed"].includes(me.verification.governmentId.state)) {
      throw new ApiError(409, "already_submitted", "Your ID is already submitted.");
    }

    const form = await readForm(c.req.raw);
    const documentType = form.get("documentType");
    if (typeof documentType !== "string" || !DOCUMENT_TYPES.has(documentType)) {
      throw new ApiError(400, "invalid_request", "documentType: choose NIN, driver's licence, passport or voter's card.");
    }
    const file = requireImage(form, "document");
    await c.env.DB.batch([
      await insertVerification(c.env, userId, "government_id", file, documentType),
      c.env.DB.prepare("UPDATE users SET id_step_completed_at = COALESCE(id_step_completed_at, ?) WHERE id = ?").bind(
        Date.now(),
        userId,
      ),
    ]);
    return c.json(await loadMe(c.env.DB, userId), 201);
  })

  .post("/government-id/skip", async (c) => {
    const userId = c.get("userId");
    assertReached(await loadMe(c.env.DB, userId), "id-verification");
    await c.env.DB.prepare("UPDATE users SET id_step_completed_at = ? WHERE id = ? AND id_step_completed_at IS NULL")
      .bind(Date.now(), userId)
      .run();
    return c.json(await loadMe(c.env.DB, userId));
  });
