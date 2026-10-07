// The admin website's API (/v1/admin). Admins are staff, not members, and sign in separately.

import type { PlanId } from "./billing";
import type { ReportReason } from "./messaging";
import type { Gender, GovernmentIdDocumentType, UserStatus } from "./onboarding";
import type { ProfileAnswers } from "./profile";

export type Admin = { id: string; email: string; name: string };

export type AdminSignInResponse = { token: string; admin: Admin };

export type Overview = {
  pendingChecks: number;
  openReports: number;
  members: Record<UserStatus, number>;
  activeSubscriptions: number;
  /** Paid this calendar month (UTC), in kobo. */
  revenueThisMonthKobo: number;
};

/** A member as shown in lists and next to checks and reports. */
export type MemberSummary = {
  id: string;
  firstName: string | null;
  email: string | null;
  age: number | null;
  gender: Gender | null;
  city: string | null;
  status: UserStatus;
  createdAt: number;
  /** R2 key of the main photo, for /v1/admin/media/<key>. */
  photoKey: string | null;
};

export type CheckKind = "liveness" | "government_id";
export type CheckStatus = "pending" | "passed" | "failed";

export type Check = {
  id: string;
  kind: CheckKind;
  status: CheckStatus;
  documentType: GovernmentIdDocumentType | null;
  /** The selfie or ID image. */
  submissionKey: string;
  submittedAt: number;
  failureReason: string | null;
  reviewedAt: number | null;
  reviewedBy: string | null;
  member: MemberSummary & { photoKeys: string[] };
};

export type ChecksResponse = { checks: Check[] };

export type CheckDecisionBody = { decision: "pass" } | { decision: "fail"; reason: string };

export type ReportStatus = "open" | "actioned" | "dismissed";

export type Report = {
  id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  createdAt: number;
  resolvedAt: number | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  reporter: MemberSummary;
  reported: MemberSummary & { openReports: number };
};

export type ReportsResponse = { reports: Report[] };

export type ResolveReportBody = { outcome: "actioned" | "dismissed"; note?: string };

export type MembersResponse = { members: MemberSummary[] };

export type AdminActionKind =
  | "verification_passed"
  | "verification_failed"
  | "report_actioned"
  | "report_dismissed"
  | "member_suspended"
  | "member_restored"
  | "email_sent";

export type AdminAction = { action: AdminActionKind; note: string | null; adminName: string; createdAt: number };

export type AdminPayment = {
  reference: string;
  plan: PlanId;
  amountKobo: number;
  status: "pending" | "paid" | "failed";
  provider: string;
  createdAt: number;
  paidAt: number | null;
  member: { id: string; firstName: string | null };
};

export type MemberDetail = {
  member: MemberSummary & { phone: string | null; dateOfBirth: string | null; unsubscribedAt: number | null };
  photoKeys: string[];
  profile: (ProfileAnswers & { publishedAt: number | null }) | null;
  checks: Omit<Check, "member">[];
  subscription: { plan: PlanId; status: "active" | "cancelled"; currentPeriodEnd: number } | null;
  payments: Omit<AdminPayment, "member">[];
  reportsAgainst: Omit<Report, "reported">[];
  reportsMade: number;
  blockedBy: number;
  history: AdminAction[];
};

export type SuspendBody = { reason: string };
export type RestoreBody = { note?: string };

export type PaymentsResponse = {
  payments: AdminPayment[];
  totals: { paidAllTimeKobo: number; paidThisMonthKobo: number; paidCount: number };
  activeSubscriptions: Record<PlanId, number>;
};

// ---- Emails from the team ----

export const MAX_EMAIL_SUBJECT = 150;
export const MAX_EMAIL_BODY = 5000;

/** Plain text. {name} becomes each member's first name. */
export type EmailDraft = { subject: string; body: string };

/** Who gets a bulk email. Suspended members, under-35s and anyone who unsubscribed never do. */
export type EmailAudience = {
  status: "active" | "onboarding" | "everyone";
  gender?: Gender;
  /** Exact city, any capitalisation. */
  city?: string;
  plan?: "with" | "without";
};

export type AudiencePreview = { count: number; unsubscribed: number };

export type EmailCounts = { queued: number; sent: number; failed: number; skipped: number };

export type EmailCampaign = {
  id: string;
  kind: "single" | "bulk";
  subject: string;
  body: string;
  audience: EmailAudience | null;
  recipientCount: number;
  createdAt: number;
  sentBy: string;
  counts: EmailCounts;
  /** Single emails: who it went to. */
  recipient: { id: string | null; firstName: string | null } | null;
};

export type EmailCampaignsResponse = {
  campaigns: EmailCampaign[];
  /** Bulk emails sent in the last 24 hours, against the daily limit (sign-in codes need room too). */
  sentToday: number;
  dailyLimit: number;
};

export type EmailRecipient = {
  userId: string | null;
  firstName: string | null;
  email: string;
  status: "queued" | "sending" | "sent" | "failed" | "skipped";
  error: string | null;
  sentAt: number | null;
};

export type EmailCampaignDetail = EmailCampaign & { recipients: EmailRecipient[] };
