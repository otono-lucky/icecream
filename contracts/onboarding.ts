export type Gender = "woman" | "man";

export type UserStatus = "onboarding" | "ineligible" | "active" | "suspended";

export type VerificationState = "not_submitted" | "pending" | "passed" | "failed";

export type GovernmentIdDocumentType = "nin" | "drivers_licence" | "passport" | "voters_card";

export const MIN_PHOTOS = 2;
export const MAX_PHOTOS = 6;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const EXPECTED_REVIEW_HOURS = 24;

/**
 * Where a member should be in onboarding. Computed by the server; the app routes on it,
 * so an interrupted sign-up resumes on the right screen.
 */
export type OnboardingStep =
  | "age-gate"
  | "basic-details"
  | "photos"
  | "liveness"
  | "id-verification"
  | "pending"
  | "ineligible"
  | "done";

export type Photo = { id: string; position: number };

export type Me = {
  user: {
    id: string;
    phone: string | null;
    email: string | null;
    status: UserStatus;
    dateOfBirth: string | null;
    firstName: string | null;
    gender: Gender | null;
    city: string | null;
  };
  photos: Photo[];
  verification: {
    liveness: { state: VerificationState; failureReason: string | null };
    governmentId: { state: VerificationState | "skipped"; failureReason: string | null };
    expectedReviewHours: number;
  };
  onboarding: { nextStep: OnboardingStep };
};

/** How a sign-in code is delivered. Sign-in is by email only; `phone` on older accounts is kept but unused. */
export type OtpChannel = "email";

export type RequestOtpBody = { channel: OtpChannel; to: string };
/** `to` comes back normalised: trimmed and lowercased. */
export type RequestOtpResponse = { channel: OtpChannel; to: string; resendAfterSeconds: number };

export type VerifyOtpBody = { channel: OtpChannel; to: string; code: string };
export type VerifyOtpResponse = { token: string; me: Me };

export type SetDateOfBirthBody = { dateOfBirth: string };
/** Every one of the member's photo ids, in the new order; the first is the main photo. */
export type ReorderPhotosBody = { photoIds: string[] };
export type SetBasicDetailsBody = { firstName: string; gender: Gender; city: string };

export type ApiErrorBody = { error: { code: string; message: string } };
