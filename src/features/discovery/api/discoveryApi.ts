import type { MemberCard, TodayResponse } from "@contracts";

import { apiRequest } from "@/shared/lib/apiClient";

export const getToday = () => apiRequest<TodayResponse>("/v1/discovery/today");

export const getMember = (id: string) => apiRequest<MemberCard>(`/v1/members/${id}`);
