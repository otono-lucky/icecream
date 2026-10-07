import type { Decision, MemberCard, ReceivedInterestsResponse } from "@contracts";

import { apiRequest } from "@/shared/lib/apiClient";

/** Interested or pass. Returns the member's card with the new decision. */
export const decideOn = (memberId: string, decision: Decision) =>
  apiRequest<MemberCard>(`/v1/members/${memberId}/decision`, { method: "PUT", json: { decision } });

export const getReceivedInterests = () => apiRequest<ReceivedInterestsResponse>("/v1/interests/received");
