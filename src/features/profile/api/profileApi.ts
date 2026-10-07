import type { MyProfile, ProfileSection, ProfileSectionBody } from "@contracts";

import { apiRequest } from "@/shared/lib/apiClient";

export const getMyProfile = () => apiRequest<MyProfile>("/v1/me/profile");

export const saveSection = <S extends ProfileSection>(section: S, body: ProfileSectionBody[S]) =>
  apiRequest<MyProfile>(`/v1/me/profile/${section}`, { method: "PUT", json: body });

export const publishProfile = () => apiRequest<MyProfile>("/v1/me/profile/publish", { method: "POST" });
