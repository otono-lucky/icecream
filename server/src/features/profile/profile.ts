import { PROFILE_SECTIONS, type MyProfile, type ProfileAnswers, type ProfileSection } from "../../../../contracts";

export type ProfileRow = {
  user_id: string;
  marital_status: ProfileAnswers["maritalStatus"];
  has_children: 0 | 1 | null;
  children_count: number | null;
  children_live_with: ProfileAnswers["childrenLiveWith"];
  open_to_partner_children: ProfileAnswers["openToPartnerWithChildren"];
  faith: ProfileAnswers["faith"];
  faith_practice: ProfileAnswers["faithPractice"];
  partner_faith_importance: ProfileAnswers["partnerFaithImportance"];
  relocate: ProfileAnswers["relocate"];
  occupation: string | null;
  typical_week: string | null;
  looking_for: ProfileAnswers["lookingFor"];
  own_words: string | null;
  published_at: number | null;
};

export const EMPTY_ANSWERS: ProfileAnswers = {
  maritalStatus: null,
  hasChildren: null,
  childrenCount: null,
  childrenLiveWith: null,
  openToPartnerWithChildren: null,
  faith: null,
  faithPractice: null,
  partnerFaithImportance: null,
  relocate: null,
  occupation: null,
  typicalWeek: null,
  lookingFor: null,
  ownWords: null,
};

export function toAnswers(row: ProfileRow | null | undefined): ProfileAnswers {
  if (!row) return EMPTY_ANSWERS;
  return {
    maritalStatus: row.marital_status,
    hasChildren: row.has_children === null ? null : row.has_children === 1,
    childrenCount: row.children_count,
    childrenLiveWith: row.children_live_with,
    openToPartnerWithChildren: row.open_to_partner_children,
    faith: row.faith,
    faithPractice: row.faith_practice,
    partnerFaithImportance: row.partner_faith_importance,
    relocate: row.relocate,
    occupation: row.occupation,
    typicalWeek: row.typical_week,
    lookingFor: row.looking_for,
    ownWords: row.own_words,
  };
}

/** Which sections are fully answered. */
export function sectionsDone(a: ProfileAnswers): ProfileSection[] {
  const done: Record<ProfileSection, boolean> = {
    "marital-history": a.maritalStatus !== null,
    children:
      a.hasChildren !== null &&
      a.openToPartnerWithChildren !== null &&
      (!a.hasChildren || (a.childrenCount !== null && a.childrenLiveWith !== null)),
    faith: a.faith !== null && a.faithPractice !== null && a.partnerFaithImportance !== null,
    location: a.relocate !== null,
    work: Boolean(a.occupation),
    "looking-for": a.lookingFor !== null,
  };
  return PROFILE_SECTIONS.filter((section) => done[section]);
}

export async function loadMyProfile(db: D1Database, userId: string): Promise<MyProfile> {
  const row = await db.prepare("SELECT * FROM profiles WHERE user_id = ?").bind(userId).first<ProfileRow>();
  const answers = toAnswers(row);
  return { answers, sectionsDone: sectionsDone(answers), publishedAt: row?.published_at ?? null };
}
