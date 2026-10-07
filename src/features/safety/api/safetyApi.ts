import type { ReportReason } from "@contracts";

import { apiRequest } from "@/shared/lib/apiClient";

export { REPORT_REASON_LABELS } from "@contracts";
export type { ReportReason };

/** Goes to the safety team's queue. The member is never told who reported them. */
export const reportMember = (memberId: string, reason: ReportReason, details: string) =>
  apiRequest<void>(`/v1/members/${memberId}/report`, { json: { reason, details: details.trim() || undefined } });

/** Hides you from each other everywhere. They're never told. */
export const blockMember = (memberId: string) => apiRequest<void>(`/v1/members/${memberId}/block`, { method: "POST" });
