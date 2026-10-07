import type { ApiErrorBody } from "@contracts";
import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * In development on a phone, "localhost" is the phone itself. Swap it for the address the phone
 * already uses to reach the Expo dev server on this computer, which follows Wi-Fi address changes.
 */
function resolveApiUrl(configured: string): string {
  if (!__DEV__ || Platform.OS === "web") return configured;
  const devServerHost = Constants.expoConfig?.hostUri?.split(":")[0];
  return devServerHost ? configured.replace(/\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/, `//${devServerHost}`) : configured;
}

const API_URL = resolveApiUrl(process.env.EXPO_PUBLIC_API_URL ?? "");

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

/** Set by the session; every request after this carries the member's token. */
export function setAuthToken(token: string | null) {
  authToken = token;
}

/** Headers that authenticate a request made outside apiRequest, e.g. an <Image> source. */
export function authHeaders(): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

/** Called when the server rejects the token, so the session can sign the member out. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

type RequestOptions = { method?: string; json?: unknown; form?: FormData };

// Expo's native fetch on iOS sets no timeout, so a request made while the connection is down or
// changing can wait forever. Give up after this long and report it like any other connection failure.
const TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 60_000;

/** Single seam for talking to the backend. Feature `api/` modules call this, screens never do. */
export async function apiRequest<T>(path: string, { method, json, form }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (json !== undefined) headers["Content-Type"] = "application/json";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), form ? UPLOAD_TIMEOUT_MS : TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: method ?? (json !== undefined || form ? "POST" : "GET"),
      headers,
      body: json !== undefined ? JSON.stringify(json) : form,
      signal: controller.signal,
    });
  } catch (cause) {
    // Anything thrown before a response (no connection, a timeout, or a request fetch couldn't build) lands here.
    if (__DEV__) console.log(`[api] ${method ?? "request"} ${API_URL}${path} failed before a response:`, String(cause));
    throw new ApiError(0, "network_error", "Can't reach icecream. Check your connection and try again.");
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    if (response.status === 401 && authToken) onUnauthorized?.();
    const error = (body as ApiErrorBody | undefined)?.error;
    throw new ApiError(response.status, error?.code ?? "unknown", error?.message ?? "Something went wrong.");
  }
  return body as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

export const apiUrl = (path: string) => `${API_URL}${path}`;
