import type { Check, EmailAudience, GovernmentIdDocumentType } from "@contracts";

const DOCUMENTS: Record<GovernmentIdDocumentType, string> = {
  nin: "NIN slip or card",
  drivers_licence: "Driver’s licence",
  passport: "Passport",
  voters_card: "Voter’s card",
};

/** "Selfie check", or "ID check · Passport". */
export const checkLabel = (check: Pick<Check, "kind" | "documentType">) =>
  check.kind === "liveness" ? "Selfie check" : `ID check · ${check.documentType ? DOCUMENTS[check.documentType] : "document"}`;

const WHO: Record<EmailAudience["status"], string> = {
  active: "Active members",
  onboarding: "Members still signing up",
  everyone: "Active and signing-up members",
};

/** "Active members · women · Lagos · with a plan". */
export function describeAudience(audience: EmailAudience) {
  return [
    WHO[audience.status],
    audience.gender === "woman" ? "women" : audience.gender === "man" ? "men" : null,
    audience.city?.trim() || null,
    audience.plan === "with" ? "with a plan" : audience.plan === "without" ? "without a plan" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
