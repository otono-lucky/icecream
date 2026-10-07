import { z } from "zod";

import { ageOn, isValidDateOfBirth, MAX_PHOTOS, MIN_AGE, todayUtc } from "../../../../contracts";
import { createRouter } from "../../lib/app";
import { randomId } from "../../lib/crypto";
import { ApiError } from "../../lib/errors";
import { readForm, requireImage, serveObject, storeImage } from "../../lib/media";
import { parseJson } from "../../lib/validation";
import { requireSession } from "../auth/sessions";

import { assertCanEdit, assertReached, loadMe } from "./me";

const touch = (db: D1Database, userId: string) =>
  db.prepare("UPDATE users SET updated_at = ? WHERE id = ?").bind(Date.now(), userId);

export const meRoutes = createRouter()
  .use(requireSession)
  .get("/", async (c) => c.json(await loadMe(c.env.DB, c.get("userId"))))

  .put("/date-of-birth", async (c) => {
    const userId = c.get("userId");
    const me = await loadMe(c.env.DB, userId);
    if (me.user.dateOfBirth) {
      throw new ApiError(409, "already_set", "Date of birth can't be changed. Contact support if it's wrong.");
    }
    assertReached(me, "age-gate");

    const { dateOfBirth } = await parseJson(c, z.object({ dateOfBirth: z.string() }));
    const today = todayUtc();
    if (!isValidDateOfBirth(dateOfBirth, today)) {
      throw new ApiError(400, "invalid_date", "Enter a real date of birth.");
    }
    const status = ageOn(dateOfBirth, today) >= MIN_AGE ? "onboarding" : "ineligible";

    await c.env.DB.prepare("UPDATE users SET date_of_birth = ?, status = ?, updated_at = ? WHERE id = ?")
      .bind(dateOfBirth, status, Date.now(), userId)
      .run();
    return c.json(await loadMe(c.env.DB, userId));
  })

  .put("/details", async (c) => {
    const userId = c.get("userId");
    const me = await loadMe(c.env.DB, userId);
    assertCanEdit(me);
    if (!me.user.dateOfBirth) throw new ApiError(409, "step_out_of_order", "Finish the earlier steps first.");

    const body = await parseJson(
      c,
      z.object({
        firstName: z.string().trim().min(1).max(50),
        gender: z.enum(["woman", "man"]),
        city: z.string().trim().min(1).max(80),
      }),
    );
    await c.env.DB.prepare("UPDATE users SET first_name = ?, gender = ?, city = ?, updated_at = ? WHERE id = ?")
      .bind(body.firstName, body.gender, body.city, Date.now(), userId)
      .run();
    return c.json(await loadMe(c.env.DB, userId));
  })

  .post("/photos", async (c) => {
    const userId = c.get("userId");
    const me = await loadMe(c.env.DB, userId);
    assertCanEdit(me);
    if (!me.user.firstName) throw new ApiError(409, "step_out_of_order", "Finish the earlier steps first.");
    if (me.photos.length >= MAX_PHOTOS) {
      throw new ApiError(409, "too_many_photos", `You can add up to ${MAX_PHOTOS} photos.`);
    }

    const file = requireImage(await readForm(c.req.raw), "photo");
    const id = randomId();
    const key = `users/${userId}/photos/${id}`;
    await storeImage(c.env.MEDIA, key, file);
    const position = Math.max(0, ...me.photos.map((photo) => photo.position)) + 1;
    await c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO photos (id, user_id, object_key, position, created_at) VALUES (?, ?, ?, ?, ?)").bind(
        id,
        userId,
        key,
        position,
        Date.now(),
      ),
      touch(c.env.DB, userId),
    ]);
    return c.json(await loadMe(c.env.DB, userId), 201);
  })

  /** Sets the photo order. The body lists every one of the member's photo ids; the first is the main photo. */
  .put("/photos/order", async (c) => {
    const userId = c.get("userId");
    const me = await loadMe(c.env.DB, userId);
    assertCanEdit(me);

    const { photoIds } = await parseJson(c, z.object({ photoIds: z.array(z.string()).max(MAX_PHOTOS) }));
    const current = new Set(me.photos.map((photo) => photo.id));
    if (photoIds.length !== current.size || new Set(photoIds).size !== photoIds.length || !photoIds.every((id) => current.has(id))) {
      throw new ApiError(400, "invalid_request", "photoIds must list each of your photos exactly once.");
    }

    await c.env.DB.batch([
      ...photoIds.map((id, index) =>
        c.env.DB.prepare("UPDATE photos SET position = ? WHERE id = ? AND user_id = ?").bind(index + 1, id, userId),
      ),
      touch(c.env.DB, userId),
    ]);
    return c.json(await loadMe(c.env.DB, userId));
  })

  /** Swaps a photo for a new image in the same place. The new photo gets a new id. */
  .post("/photos/:id/replace", async (c) => {
    const userId = c.get("userId");
    assertCanEdit(await loadMe(c.env.DB, userId));
    const old = await c.env.DB.prepare("SELECT object_key, position FROM photos WHERE id = ? AND user_id = ?")
      .bind(c.req.param("id"), userId)
      .first<{ object_key: string; position: number }>();
    if (!old) throw new ApiError(404, "not_found", "Photo not found.");

    const file = requireImage(await readForm(c.req.raw), "photo");
    const id = randomId();
    const key = `users/${userId}/photos/${id}`;
    await storeImage(c.env.MEDIA, key, file);
    await c.env.DB.batch([
      c.env.DB.prepare("DELETE FROM photos WHERE id = ?").bind(c.req.param("id")),
      c.env.DB.prepare("INSERT INTO photos (id, user_id, object_key, position, created_at) VALUES (?, ?, ?, ?, ?)").bind(
        id,
        userId,
        key,
        old.position,
        Date.now(),
      ),
      touch(c.env.DB, userId),
    ]);
    await c.env.MEDIA.delete(old.object_key);
    return c.json(await loadMe(c.env.DB, userId));
  })

  .get("/photos/:id", async (c) => {
    const photo = await c.env.DB.prepare("SELECT object_key FROM photos WHERE id = ? AND user_id = ?")
      .bind(c.req.param("id"), c.get("userId"))
      .first<{ object_key: string }>();
    if (!photo) throw new ApiError(404, "not_found", "Photo not found.");
    return serveObject(c.env.MEDIA, photo.object_key);
  })

  .delete("/photos/:id", async (c) => {
    const userId = c.get("userId");
    assertCanEdit(await loadMe(c.env.DB, userId));
    const photo = await c.env.DB.prepare("SELECT object_key FROM photos WHERE id = ? AND user_id = ?")
      .bind(c.req.param("id"), userId)
      .first<{ object_key: string }>();
    if (!photo) throw new ApiError(404, "not_found", "Photo not found.");

    await c.env.DB.prepare("DELETE FROM photos WHERE id = ?").bind(c.req.param("id")).run();
    await c.env.MEDIA.delete(photo.object_key);
    return c.json(await loadMe(c.env.DB, userId));
  });
