
import { z } from "zod";

import {
  ageOn,
  DAILY_INTRODUCTION_LIMIT,
  todayUtc,
  type Decision,
  type MemberCard,
  type ProfileAnswers,
  type ReceivedInterestsResponse,
  type TodayResponse,
  type VerificationBadge,
} from "../../../../contracts";
import { createRouter } from "../../lib/app";
import { sha256Hex } from "../../lib/crypto";
import { ApiError } from "../../lib/errors";
import { serveObject } from "../../lib/media";
import { toAnswers, type ProfileRow } from "../profile/profile";
import { parseJson } from "../../lib/validation";
import { requireSession } from "../auth/sessions";

import { requireActive, VISIBLE_MEMBER, visibleBinds, type Viewer } from "./visibility";

type CandidateRow = { id: string; first_name: string; date_of_birth: string; city: string };

/** Why someone was suggested (PRD 4.3): up to two things you have in common, else how they're verified. */
function suggestionReason(
  viewer: Viewer,
  mine: ProfileAnswers,
  row: CandidateRow,
  theirs: ProfileAnswers | null,
  badges: VerificationBadge[],
): string {
  const reasons: string[] = [];
  if (row.city.toLowerCase() === viewer.city.toLowerCase()) reasons.push(`Also in ${row.city}`);
  if (theirs?.faith && theirs.faith !== "none" && theirs.faith === mine.faith) reasons.push("Shares your faith");
  if (theirs?.lookingFor && theirs.lookingFor === mine.lookingFor) {
    reasons.push(theirs.lookingFor === "marriage" ? "Also looking for marriage" : "Wants what you want");
  }
  if (!reasons.length && theirs?.relocate === "yes") reasons.push("Open to relocating");
  if (reasons.length) return reasons.slice(0, 2).join(" · ");
  return badges.includes("governmentId") ? "ID-verified member" : "Verified member";
}

async function toCards(db: D1Database, viewer: Viewer, rows: CandidateRow[]): Promise<MemberCard[]> {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const marks = ids.map(() => "?").join(", ");
  const [photos, badges, mine, theirs, profiles, viewerProfile] = await db.batch([
    db.prepare(`SELECT id, user_id FROM photos WHERE user_id IN (${marks}) ORDER BY position`).bind(...ids),
    db
      .prepare(`SELECT DISTINCT user_id, kind FROM verifications WHERE status = 'passed' AND user_id IN (${marks})`)
      .bind(...ids),
    db
      .prepare(`SELECT to_user_id AS id, decision FROM decisions WHERE from_user_id = ? AND to_user_id IN (${marks})`)
      .bind(viewer.id, ...ids),
    db
      .prepare(
        `SELECT from_user_id AS id FROM decisions WHERE to_user_id = ? AND decision = 'interest' AND from_user_id IN (${marks})`,
      )
      .bind(viewer.id, ...ids),
    db.prepare(`SELECT * FROM profiles WHERE published_at IS NOT NULL AND user_id IN (${marks})`).bind(...ids),
    db.prepare("SELECT * FROM profiles WHERE user_id = ?").bind(viewer.id),
  ]);
  const profileById = new Map((profiles.results as ProfileRow[]).map((row) => [row.user_id, toAnswers(row)]));
  const mine_ = toAnswers(viewerProfile.results[0] as ProfileRow | undefined);
  const myDecisions = new Map((mine.results as { id: string; decision: Decision }[]).map((row) => [row.id, row.decision]));
  const interestedInMe = new Set((theirs.results as { id: string }[]).map((row) => row.id));
  const today = todayUtc();

  return rows.map((row) => {
    const memberBadges = (badges.results as { user_id: string; kind: string }[])
      .filter((badge) => badge.user_id === row.id)
      .map((badge): VerificationBadge => (badge.kind === "government_id" ? "governmentId" : "photo"));
    return {
      id: row.id,
      firstName: row.first_name,
      age: ageOn(row.date_of_birth, today),
      city: row.city,
      photoIds: (photos.results as { id: string; user_id: string }[])
        .filter((photo) => photo.user_id === row.id)
        .map((photo) => photo.id),
      badges: memberBadges.sort(),
      reason: suggestionReason(viewer, mine_, row, profileById.get(row.id) ?? null, memberBadges),
      decision: myDecisions.get(row.id) ?? null,
      interestedInYou: interestedInMe.has(row.id),
      profile: profileById.get(row.id) ?? null,
    };
  });
}

// Mounted at /v1/discovery and /v1/members (not /v1), so these checks don't reach other routes.
export const discoveryRoutes = createRouter()
  .use(requireSession)
  .use(requireActive)

  /**
   * Today's introductions: a small set, the same all day, different tomorrow (PRD 3.3: a limited,
   * curated set of profiles per day rather than an endless deck). The order is a stable shuffle keyed
   * on the viewer and the date.
   */
  .get("/today", async (c) => {
    const viewer = c.get("viewer");
    const { results } = await c.env.DB.prepare(
      `SELECT u.id, u.first_name, u.date_of_birth, u.city FROM users u WHERE ${VISIBLE_MEMBER}
       AND EXISTS (SELECT 1 FROM profiles pr WHERE pr.user_id = u.id AND pr.published_at IS NOT NULL)
       AND NOT EXISTS (SELECT 1 FROM decisions d WHERE d.from_user_id = ? AND d.to_user_id = u.id
                       AND d.decision = 'pass' AND d.decided_at < ?)
       LIMIT 500`,
    )
      .bind(...visibleBinds(viewer), viewer.id, Date.parse(`${todayUtc()}T00:00:00Z`))
      .all<CandidateRow>();

    const day = todayUtc();
    const keyed = await Promise.all(
      results.map(async (row) => ({ row, key: await sha256Hex(`${viewer.id}:${day}:${row.id}`) })),
    );
    const picked = keyed
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(0, DAILY_INTRODUCTION_LIMIT)
      .map(({ row }) => row);

    return c.json<TodayResponse>({ introductions: await toCards(c.env.DB, viewer, picked) });
  });

export const memberRoutes = createRouter()
  .use(requireSession)
  .use(requireActive)

  .get("/:id", async (c) => {
    const viewer = c.get("viewer");
    const row = await c.env.DB.prepare(
      `SELECT u.id, u.first_name, u.date_of_birth, u.city FROM users u WHERE u.id = ? AND ${VISIBLE_MEMBER}`,
    )
      .bind(c.req.param("id"), ...visibleBinds(viewer))
      .first<CandidateRow>();
    if (!row) throw new ApiError(404, "not_found", "This profile is no longer available.");
    const [card] = await toCards(c.env.DB, viewer, [row]);
    return c.json<MemberCard>(card);
  })

  /** Interested or pass. Free and private to make (PRD 4.3); only interest is ever shown to the other member. */
  .put("/:id/decision", async (c) => {
    const viewer = c.get("viewer");
    const { decision } = await parseJson(c, z.object({ decision: z.enum(["interest", "pass"]) }));
    const row = await c.env.DB.prepare(
      `SELECT u.id, u.first_name, u.date_of_birth, u.city FROM users u WHERE u.id = ? AND ${VISIBLE_MEMBER}`,
    )
      .bind(c.req.param("id"), ...visibleBinds(viewer))
      .first<CandidateRow>();
    if (!row) throw new ApiError(404, "not_found", "This profile is no longer available.");

    await c.env.DB.prepare(
      `INSERT INTO decisions (from_user_id, to_user_id, decision, decided_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (from_user_id, to_user_id) DO UPDATE SET decision = excluded.decision, decided_at = excluded.decided_at`,
    )
      .bind(viewer.id, row.id, decision, Date.now())
      .run();
    const [card] = await toCards(c.env.DB, viewer, [row]);
    return c.json<MemberCard>(card);
  })

  .get("/:id/photos/:photoId", async (c) => {
    const viewer = c.get("viewer");
    const photo = await c.env.DB.prepare(
      `SELECT p.object_key FROM photos p JOIN users u ON u.id = p.user_id
       WHERE p.id = ? AND u.id = ? AND ${VISIBLE_MEMBER}`,
    )
      .bind(c.req.param("photoId"), c.req.param("id"), ...visibleBinds(viewer))
      .first<{ object_key: string }>();
    if (!photo) throw new ApiError(404, "not_found", "Photo not found.");
    return serveObject(c.env.MEDIA, photo.object_key);
  });

export const interestRoutes = createRouter()
  .use(requireSession)
  .use(requireActive)

  /**
   * Who has expressed interest in the viewer. People the viewer passed on are left out, so a quiet
   * "not for me" removes them without the other member ever being told (PRD 1.4, dignity).
   */
  .get("/received", async (c) => {
    const viewer = c.get("viewer");
    const { results } = await c.env.DB.prepare(
      `SELECT u.id, u.first_name, u.date_of_birth, u.city FROM decisions theirs
       JOIN users u ON u.id = theirs.from_user_id
       WHERE theirs.to_user_id = ? AND theirs.decision = 'interest' AND ${VISIBLE_MEMBER}
         AND NOT EXISTS (SELECT 1 FROM decisions mine WHERE mine.from_user_id = ? AND mine.to_user_id = u.id
                         AND mine.decision = 'pass')
       ORDER BY theirs.decided_at DESC LIMIT 100`,
    )
      .bind(viewer.id, ...visibleBinds(viewer), viewer.id)
      .all<CandidateRow>();
    return c.json<ReceivedInterestsResponse>({ interests: await toCards(c.env.DB, viewer, results) });
  });
