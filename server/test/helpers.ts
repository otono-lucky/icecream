import { env, exports } from "cloudflare:workers";
import { expect } from "vitest";

import type { ApiErrorBody, Me, VerifyOtpResponse } from "../../contracts";

export const FIXED_CODE = "123456";

type RequestOptions = { method?: string; token?: string; json?: unknown; form?: FormData };

export async function call(path: string, { method, token, json, form }: RequestOptions = {}) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json !== undefined) headers["Content-Type"] = "application/json";
  return exports.default.fetch(`http://api.test${path}`, {
    method: method ?? (json !== undefined || form ? "POST" : "GET"),
    headers,
    body: json !== undefined ? JSON.stringify(json) : form,
    // Look at redirects (e.g. back to the app after checkout) instead of following them.
    redirect: "manual",
  });
}

export async function expectError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(((await response.json()) as ApiErrorBody).error.code).toBe(code);
}

export async function expectMe(response: Response, status = 200): Promise<Me> {
  expect(response.status, await response.clone().text()).toBe(status);
  return (await response.json()) as Me;
}

let emailCounter = 0;
export function newEmail(): string {
  emailCounter += 1;
  return `member${Date.now()}${emailCounter}@example.com`;
}

export const email = (to: string, code?: string) => ({ channel: "email", to, ...(code ? { code } : {}) });

export async function signIn(address = newEmail()): Promise<VerifyOtpResponse> {
  return signInWith(email(address));
}

export async function signInWith(destination: { channel: string; to: string }): Promise<VerifyOtpResponse> {
  expect((await call("/v1/auth/otp/request", { json: destination })).status).toBe(200);
  const response = await call("/v1/auth/otp/verify", { json: { ...destination, code: FIXED_CODE } });
  expect(response.status).toBe(200);
  return (await response.json()) as VerifyOtpResponse;
}

export function imageForm(field: string, extra: Record<string, string> = {}, type = "image/jpeg"): FormData {
  const form = new FormData();
  form.append(field, new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], "image.jpg", { type }));
  for (const [key, value] of Object.entries(extra)) form.append(key, value);
  return form;
}

/** Walks a new member up to (not including) the liveness step. */
export async function signUpToLiveness(): Promise<string> {
  const { token } = await signIn();
  await expectMe(await call("/v1/me/date-of-birth", { method: "PUT", token, json: { dateOfBirth: "1980-05-20" } }));
  await expectMe(
    await call("/v1/me/details", { method: "PUT", token, json: { firstName: "Ada", gender: "woman", city: "Lagos" } }),
  );
  await expectMe(await call("/v1/me/photos", { token, form: imageForm("photo") }), 201);
  const me = await expectMe(await call("/v1/me/photos", { token, form: imageForm("photo") }), 201);
  expect(me.onboarding.nextStep).toBe("liveness");
  return token;
}

let adminCounter = 0;

/** Adds an admin account, as `npm run admin:add` does, and signs it in through the admin sign-in. */
export async function signInAdmin(name = "Test Admin"): Promise<{ token: string; id: string; email: string }> {
  adminCounter += 1;
  const id = `admin-${Date.now()}-${adminCounter}`;
  const email = `${id}@icecream.test`;
  await env.DB.prepare("INSERT INTO admins (id, email, name, created_at) VALUES (?, ?, ?, ?)").bind(id, email, name, Date.now()).run();
  expect((await call("/v1/admin/auth/request", { json: { email } })).status).toBe(200);
  const response = await call("/v1/admin/auth/verify", { json: { email, code: FIXED_CODE } });
  expect(response.status).toBe(200);
  return { token: ((await response.json()) as { token: string }).token, id, email };
}

export async function pendingVerifications() {
  const { token } = await signInAdmin();
  const response = await call("/v1/admin/checks", { token });
  expect(response.status).toBe(200);
  return ((await response.json()) as { checks: { id: string; kind: string; member: { id: string } }[] }).checks;
}

export async function decide(verificationId: string, decision: { decision: "pass" } | { decision: "fail"; reason: string }) {
  const { token } = await signInAdmin();
  return call(`/v1/admin/checks/${verificationId}/decision`, { token, json: decision });
}

/** Answers every profile section and publishes, so the member can be introduced. */
export async function publishProfile(token: string, overrides: { faith?: string; lookingFor?: string } = {}) {
  const put = (section: string, json: unknown) => call(`/v1/me/profile/${section}`, { method: "PUT", token, json });
  await put("marital-history", { maritalStatus: "divorced" });
  await put("children", { hasChildren: true, childrenCount: 2, childrenLiveWith: "some", openToPartnerWithChildren: "yes" });
  await put("faith", { faith: overrides.faith ?? "christian", faithPractice: "practising", partnerFaithImportance: "prefer_match" });
  await put("location", { relocate: "maybe" });
  await put("work", { occupation: "Teacher", typicalWeek: "School on weekdays, church on Sundays." });
  await put("looking-for", { lookingFor: overrides.lookingFor ?? "marriage", ownWords: "Someone kind and steady." });
  const published = await call("/v1/me/profile/publish", { method: "POST", token });
  expect(published.status).toBe(200);
}

/** A fully verified member (selfie passed, ID skipped) with a published profile, ready to browse or be browsed. */
export async function activeMember(
  details: { firstName: string; gender: "woman" | "man"; city: string },
  options: { publish?: boolean; faith?: string; lookingFor?: string } = {},
) {
  const { token, me } = await signIn();
  await call("/v1/me/date-of-birth", { method: "PUT", token, json: { dateOfBirth: "1978-03-15" } });
  await call("/v1/me/details", { method: "PUT", token, json: details });
  await call("/v1/me/photos", { token, form: imageForm("photo") });
  await call("/v1/me/photos", { token, form: imageForm("photo") });
  await call("/v1/verification/liveness", { token, form: imageForm("selfie") });
  await call("/v1/verification/government-id/skip", { method: "POST", token });
  const selfie = (await pendingVerifications()).find((v) => v.member.id === me.user.id)!;
  expect((await decide(selfie.id, { decision: "pass" })).status).toBe(204);
  if (options.publish !== false) await publishProfile(token, options);
  return { token, id: me.user.id };
}
