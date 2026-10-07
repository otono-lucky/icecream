import { z } from "zod";

import {
  MAX_OWN_WORDS,
  MAX_TYPICAL_WEEK,
  PROFILE_SECTIONS,
  type MyProfile,
  type ProfileSection,
} from "../../../../contracts";
import { createRouter } from "../../lib/app";
import { ApiError } from "../../lib/errors";
import { parseJson } from "../../lib/validation";
import { requireSession } from "../auth/sessions";
import { assertCanEdit, loadMe } from "../me/me";

import { loadMyProfile } from "./profile";

const yesMaybeNo = z.enum(["yes", "maybe", "no"]);

/** Each section's answers, and the profile columns they fill. */
const SECTIONS: Record<ProfileSection, { schema: z.ZodType; columns: (body: never) => Record<string, unknown> }> = {
  "marital-history": {
    schema: z.object({ maritalStatus: z.enum(["never_married", "divorced", "separated", "widowed"]) }),
    columns: (b: { maritalStatus: string }) => ({ marital_status: b.maritalStatus }),
  },
  children: {
    schema: z
      .object({
        hasChildren: z.boolean(),
        childrenCount: z.number().int().min(1).max(20).optional(),
        childrenLiveWith: z.enum(["all", "some", "none"]).optional(),
        openToPartnerWithChildren: yesMaybeNo,
      })
      .refine((b) => !b.hasChildren || (b.childrenCount !== undefined && b.childrenLiveWith !== undefined), {
        message: "say how many children and whether they live with you",
        path: ["childrenCount"],
      }),
    columns: (b: { hasChildren: boolean; childrenCount?: number; childrenLiveWith?: string; openToPartnerWithChildren: string }) => ({
      has_children: b.hasChildren ? 1 : 0,
      children_count: b.hasChildren ? b.childrenCount : null,
      children_live_with: b.hasChildren ? b.childrenLiveWith : null,
      open_to_partner_children: b.openToPartnerWithChildren,
    }),
  },
  faith: {
    schema: z.object({
      faith: z.enum(["christian", "muslim", "traditional", "other", "none"]),
      faithPractice: z.enum(["devout", "practising", "occasional", "not_religious"]),
      partnerFaithImportance: z.enum(["must_match", "prefer_match", "doesnt_matter"]),
    }),
    columns: (b: { faith: string; faithPractice: string; partnerFaithImportance: string }) => ({
      faith: b.faith,
      faith_practice: b.faithPractice,
      partner_faith_importance: b.partnerFaithImportance,
    }),
  },
  location: {
    schema: z.object({ city: z.string().trim().min(1).max(80).optional(), relocate: yesMaybeNo }),
    columns: (b: { relocate: string }) => ({ relocate: b.relocate }),
  },
  work: {
    schema: z.object({
      occupation: z.string().trim().min(1).max(80),
      typicalWeek: z.string().trim().max(MAX_TYPICAL_WEEK).optional(),
    }),
    columns: (b: { occupation: string; typicalWeek?: string }) => ({ occupation: b.occupation, typical_week: b.typicalWeek || null }),
  },
  "looking-for": {
    schema: z.object({
      lookingFor: z.enum(["marriage", "committed", "companionship"]),
      ownWords: z.string().trim().max(MAX_OWN_WORDS).optional(),
    }),
    columns: (b: { lookingFor: string; ownWords?: string }) => ({ looking_for: b.lookingFor, own_words: b.ownWords || null }),
  },
};

/** The member's own profile (PRD 4.2). Mounted at /v1/me/profile. */
export const profileRoutes = createRouter()
  .use(requireSession)

  .get("/", async (c) => c.json<MyProfile>(await loadMyProfile(c.env.DB, c.get("userId"))))

  /** Answers one section. Can be done during onboarding or any time after, to edit. */
  .put("/:section", async (c) => {
    const userId = c.get("userId");
    assertCanEdit(await loadMe(c.env.DB, userId));
    const section = c.req.param("section") as ProfileSection;
    if (!PROFILE_SECTIONS.includes(section)) throw new ApiError(404, "not_found", "Unknown profile section.");

    const body = await parseJson(c, SECTIONS[section].schema);
    const columns = SECTIONS[section].columns(body as never);
    const names = Object.keys(columns);
    const now = Date.now();
    const statements = [
      c.env.DB.prepare(
        `INSERT INTO profiles (user_id, ${names.join(", ")}, updated_at) VALUES (?, ${names.map(() => "?").join(", ")}, ?)
         ON CONFLICT (user_id) DO UPDATE SET ${names.map((n) => `${n} = excluded.${n}`).join(", ")}, updated_at = excluded.updated_at`,
      ).bind(userId, ...Object.values(columns), now),
    ];
    // Where you live also lets the member change the city given at sign-up.
    const city = (body as { city?: string }).city;
    if (section === "location" && city) {
      statements.push(c.env.DB.prepare("UPDATE users SET city = ?, updated_at = ? WHERE id = ?").bind(city, now, userId));
    }
    await c.env.DB.batch(statements);
    return c.json<MyProfile>(await loadMyProfile(c.env.DB, userId));
  })

  /** Publishing makes the profile visible in introductions. Every section must be answered first. */
  .post("/publish", async (c) => {
    const userId = c.get("userId");
    assertCanEdit(await loadMe(c.env.DB, userId));
    const profile = await loadMyProfile(c.env.DB, userId);
    const missing = PROFILE_SECTIONS.filter((section) => !profile.sectionsDone.includes(section));
    if (missing.length) {
      throw new ApiError(409, "profile_incomplete", `Finish these sections first: ${missing.join(", ")}.`);
    }
    await c.env.DB.prepare("UPDATE profiles SET published_at = COALESCE(published_at, ?), updated_at = ? WHERE user_id = ?")
      .bind(Date.now(), Date.now(), userId)
      .run();
    return c.json<MyProfile>(await loadMyProfile(c.env.DB, userId));
  });
