import type { ProfileAnswers } from "./profile";

export type VerificationBadge = "photo" | "governmentId";

/** The viewer's decision about another member. Interest is shown to them; a pass never is. */
export type Decision = "interest" | "pass";

/** What one member can see of another while browsing. Profile facts arrive with Part 2. */
export type MemberCard = {
  id: string;
  firstName: string;
  age: number;
  city: string;
  /** In display order; the first is the main photo. Served at /v1/members/:id/photos/:photoId. */
  photoIds: string[];
  badges: VerificationBadge[];
  /** Why this person was suggested (PRD 4.3). */
  reason: string;
  /** What the viewer decided about this member, if anything. */
  decision: Decision | null;
  /** Whether this member has expressed interest in the viewer. */
  interestedInYou: boolean;
  /** Their published profile answers; null until they publish (PRD 4.2). */
  profile: ProfileAnswers | null;
};

export const DAILY_INTRODUCTION_LIMIT = 5;

export type TodayResponse = { introductions: MemberCard[] };

export type DecisionBody = { decision: Decision };

/** People who have expressed interest in the viewer, newest first (PRD 4.3, Interests received). */
export type ReceivedInterestsResponse = { interests: MemberCard[] };
