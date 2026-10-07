import type { Me, RequestOtpResponse, VerifyOtpResponse } from "@contracts";

import { apiRequest } from "@/shared/lib/apiClient";

// Sign-in is by email only; `channel` stays in the request so the API can say so if it ever changes.
export const requestOtp = (email: string) =>
  apiRequest<RequestOtpResponse>("/v1/auth/otp/request", { json: { channel: "email", to: email } });

export const verifyOtp = (email: string, code: string) =>
  apiRequest<VerifyOtpResponse>("/v1/auth/otp/verify", { json: { channel: "email", to: email, code } });

export const getMe = () => apiRequest<Me>("/v1/me");

export const signOutRemote = () => apiRequest<void>("/v1/auth/sign-out", { method: "POST" });
