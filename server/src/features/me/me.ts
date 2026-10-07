import {
  EXPECTED_REVIEW_HOURS,
  MIN_PHOTOS,
  type Gender,
  type Me,
  type OnboardingStep,
  type UserStatus,
  type VerificationState,
} from "../../../../contracts";
import { ApiError } from "../../lib/errors";

type UserRow = {
  id: string;
  phone: string | null;
  email: string | null;
  status: UserStatus;
  date_of_birth: string | null;
  first_name: string | null;
  gender: Gender | null;
  city: string | null;
  id_step_completed_at: number | null;
};

type VerificationRow = { status: "pending" | "passed" | "failed"; failure_reason: string | null };

const latestVerification = (db: D1Database, userId: string, kind: "liveness" | "government_id") =>
  db
    .prepare(
      `SELECT status, failure_reason FROM verifications
       WHERE user_id = ? AND kind = ? ORDER BY submitted_at DESC, rowid DESC LIMIT 1`,
    )
    .bind(userId, kind);

export async function loadMe(db: D1Database, userId: string): Promise<Me> {
  const [users, photos, liveness, governmentId] = await db.batch([
    db.prepare(
      `SELECT id, phone, email, status, date_of_birth, first_name, gender, city, id_step_completed_at
       FROM users WHERE id = ?`,
    ).bind(userId),
    db.prepare("SELECT id, position FROM photos WHERE user_id = ? ORDER BY position").bind(userId),
    latestVerification(db, userId, "liveness"),
    latestVerification(db, userId, "government_id"),
  ]);

  const user = users.results[0] as UserRow | undefined;
  if (!user) throw new ApiError(404, "not_found", "Account not found.");
  const livenessRow = liveness.results[0] as VerificationRow | undefined;
  const idRow = governmentId.results[0] as VerificationRow | undefined;

  const livenessState: VerificationState = livenessRow?.status ?? "not_submitted";
  const idState = idRow?.status ?? (user.id_step_completed_at ? "skipped" : "not_submitted");
  const photoList = photos.results as { id: string; position: number }[];

  return {
    user: {
      id: user.id,
      phone: user.phone,
      email: user.email,
      status: user.status,
      dateOfBirth: user.date_of_birth,
      firstName: user.first_name,
      gender: user.gender,
      city: user.city,
    },
    photos: photoList,
    verification: {
      liveness: { state: livenessState, failureReason: livenessRow?.failure_reason ?? null },
      governmentId: { state: idState, failureReason: idRow?.failure_reason ?? null },
      expectedReviewHours: EXPECTED_REVIEW_HOURS,
    },
    onboarding: {
      nextStep: nextStep(user, photoList.length, livenessState, user.id_step_completed_at !== null),
    },
  };
}

function nextStep(
  user: UserRow,
  photoCount: number,
  liveness: VerificationState,
  idStepDone: boolean,
): OnboardingStep {
  if (user.status === "ineligible") return "ineligible";
  if (user.status === "active") return "done";
  if (!user.date_of_birth) return "age-gate";
  if (!user.first_name || !user.gender || !user.city) return "basic-details";
  if (photoCount < MIN_PHOTOS) return "photos";
  if (liveness === "not_submitted" || liveness === "failed") return "liveness";
  if (!idStepDone) return "id-verification";
  return "pending";
}

/** Guards for write endpoints: reject members who can't act, and steps taken out of order. */
export function assertCanEdit(me: Me): void {
  if (me.user.status === "ineligible" || me.user.status === "suspended") {
    throw new ApiError(403, "not_allowed", "This account can't be changed.");
  }
}

export function assertReached(me: Me, ...steps: OnboardingStep[]): void {
  assertCanEdit(me);
  if (me.user.status === "onboarding" && !steps.includes(me.onboarding.nextStep)) {
    throw new ApiError(409, "step_out_of_order", "Finish the earlier steps first.");
  }
}
