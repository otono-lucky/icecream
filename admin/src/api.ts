import type { Admin, ApiErrorBody } from "@contracts";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8787";
const SESSION_KEY = "icecream.admin.session";

export type Session = { token: string; admin: Admin };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

// ---- Session (kept in this browser only; admin sessions last 12 hours on the server) ----

const listeners = new Set<() => void>();
let session: Session | null = readSession();

function readSession(): Session | null {
  try {
    const saved = localStorage.getItem(SESSION_KEY);
    return saved ? (JSON.parse(saved) as Session) : null;
  } catch {
    return null;
  }
}

export function getSession() {
  return session;
}

export function setSession(next: Session | null) {
  session = next;
  try {
    if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Private windows can refuse storage; the session then lasts until the tab closes.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ---- Requests ----

export async function api<T>(path: string, options: { method?: string; json?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (session) headers.Authorization = `Bearer ${session.token}`;
  if (options.json !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${API_URL}/v1/admin${path}`, {
      method: options.method ?? (options.json !== undefined ? "POST" : "GET"),
      headers,
      body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
    });
  } catch {
    throw new ApiError(0, "network_error", "Can't reach the icecream server. Check your connection and try again.");
  }

  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    // The session expired or the admin was disabled: back to sign-in.
    if (response.status === 401 && session) setSession(null);
    const error = (body as ApiErrorBody | undefined)?.error;
    throw new ApiError(response.status, error?.code ?? "unknown", error?.message ?? "Something went wrong.");
  }
  return body as T;
}

export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.");

// ---- Images (members' photos, selfies and IDs need the admin's token, so they're fetched, not linked) ----

const imageCache = new Map<string, Promise<string>>();

export function loadImage(key: string): Promise<string> {
  let url = imageCache.get(key);
  if (!url) {
    url = fetch(`${API_URL}/v1/admin/media/${encodeURIComponent(key).replace(/%2F/g, "/")}`, {
      headers: session ? { Authorization: `Bearer ${session.token}` } : {},
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Image ${response.status}`);
      return URL.createObjectURL(await response.blob());
    });
    url.catch(() => imageCache.delete(key));
    imageCache.set(key, url);
  }
  return url;
}
