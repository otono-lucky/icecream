import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import type {
  CheckoutResponse,
  ChecksResponse,
  MemberDetail,
  MembersResponse,
  Overview,
  PaymentsResponse,
  ReportsResponse,
} from "../../contracts";

import {
  activeMember,
  call,
  expectError,
  expectMe,
  FIXED_CODE,
  imageForm,
  signIn,
  signInAdmin,
  signUpToLiveness,
} from "./helpers";

const uniqueCity = () => `Adminville ${Math.random().toString(36).slice(2, 8)}`;
const json = async <T>(response: Response) => {
  expect(response.status, await response.clone().text()).toBe(200);
  return (await response.json()) as T;
};

describe("admin sign-in", () => {
  it("emails a code to an admin and signs them in", async () => {
    const { token } = await signInAdmin("Bola");
    expect(await json<{ name: string }>(await call("/v1/admin/me", { token }))).toMatchObject({ name: "Bola" });
  });

  it("answers a non-admin the same way but sends no code, so it can't be used to find admins", async () => {
    const email = `nobody${Date.now()}@example.com`;
    expect((await call("/v1/admin/auth/request", { json: { email } })).status).toBe(200);
    const stored = await env.DB.prepare("SELECT COUNT(*) AS n FROM otp_challenges WHERE destination LIKE ?")
      .bind(`%${email}`)
      .first<{ n: number }>();
    expect(stored?.n).toBe(0);
    await expectError(await call("/v1/admin/auth/verify", { json: { email, code: FIXED_CODE } }), 400, "code_expired");
  });

  it("keeps admin codes apart from member codes for the same email", async () => {
    const admin = await signInAdmin();
    // The admin's email can also sign in as a member, with its own code.
    const member = await signIn(admin.email);
    await expectError(await call("/v1/admin/me", { token: member.token }), 401, "unauthorized");
  });

  it("stops a disabled admin straight away, and sign-out ends a session", async () => {
    const admin = await signInAdmin();
    await env.DB.prepare("UPDATE admins SET disabled_at = ? WHERE id = ?").bind(Date.now(), admin.id).run();
    await expectError(await call("/v1/admin/me", { token: admin.token }), 401, "unauthorized");

    const other = await signInAdmin();
    expect((await call("/v1/admin/auth/sign-out", { method: "POST", token: other.token })).status).toBe(204);
    await expectError(await call("/v1/admin/me", { token: other.token }), 401, "unauthorized");
  });
});

describe("checks", () => {
  it("lists a waiting selfie check with the member's photos, and passing it lets them in", async () => {
    const token = await signUpToLiveness();
    const me = await expectMe(await call("/v1/verification/liveness", { token, form: imageForm("selfie") }), 201);
    const admin = await signInAdmin("Kemi");

    const { checks } = await json<ChecksResponse>(await call("/v1/admin/checks", { token: admin.token }));
    const check = checks.find((c) => c.member.id === me.user.id)!;
    expect(check).toMatchObject({ kind: "liveness", status: "pending", member: { firstName: "Ada", status: "onboarding" } });
    expect(check.member.photoKeys).toHaveLength(2);
    expect((await call(`/v1/admin/media/${check.submissionKey}`, { token: admin.token })).status).toBe(200);

    expect((await call(`/v1/admin/checks/${check.id}/decision`, { token: admin.token, json: { decision: "pass" } })).status).toBe(204);
    await call("/v1/verification/government-id/skip", { method: "POST", token });
    expect((await expectMe(await call("/v1/me", { token }))).user.status).toBe("active");

    const passed = await json<ChecksResponse>(await call("/v1/admin/checks?status=passed", { token: admin.token }));
    expect(passed.checks.find((c) => c.id === check.id)).toMatchObject({ reviewedBy: "Kemi" });
    await expectError(
      await call(`/v1/admin/checks/${check.id}/decision`, { token: admin.token, json: { decision: "pass" } }),
      409,
      "already_decided",
    );
  });
});

describe("check filters", () => {
  it("narrows waiting checks by kind, gender and a name, email or city search", async () => {
    const city = uniqueCity();
    const token = await signUpToLiveness();
    // signUpToLiveness makes "Ada", a woman in Lagos; move her to a city only this test uses.
    await call("/v1/me/details", { method: "PUT", token, json: { firstName: "Ada", gender: "woman", city } });
    const me = await expectMe(await call("/v1/verification/liveness", { token, form: imageForm("selfie") }), 201);
    const admin = await signInAdmin();
    const ids = async (query: string) =>
      (await json<ChecksResponse>(await call(`/v1/admin/checks?${query}`, { token: admin.token }))).checks.map((c) => c.member.id);

    expect(await ids(`q=${encodeURIComponent(city.toLowerCase())}`)).toEqual([me.user.id]);
    expect(await ids(`q=${encodeURIComponent(city)}&kind=liveness&gender=woman`)).toEqual([me.user.id]);
    expect(await ids(`q=${encodeURIComponent(city)}&gender=man`)).toEqual([]);
    expect(await ids(`q=${encodeURIComponent(city)}&kind=government_id`)).toEqual([]);
    expect(await ids(`q=${encodeURIComponent(city)}&status=passed`)).toEqual([]);
  });

  it("sorts oldest or newest first", async () => {
    const admin = await signInAdmin();
    const sentAt = async (sort: string) =>
      (await json<ChecksResponse>(await call(`/v1/admin/checks?sort=${sort}`, { token: admin.token }))).checks.map((c) => c.submittedAt);
    for (const token of [await signUpToLiveness(), await signUpToLiveness()]) {
      await call("/v1/verification/liveness", { token, form: imageForm("selfie") });
    }
    const oldest = await sentAt("oldest");
    expect(oldest).toEqual([...oldest].sort((a, b) => a - b));
    const newest = await sentAt("newest");
    expect(newest).toEqual([...newest].sort((a, b) => b - a));
  });
});

describe("reports", () => {
  it("shows open reports with both members, and records how each was dealt with", async () => {
    const woman = await activeMember({ firstName: "Ifeoma", gender: "woman", city: uniqueCity() });
    const man = await activeMember({ firstName: "Segun", gender: "man", city: uniqueCity() });
    await call(`/v1/members/${man.id}/report`, { token: woman.token, json: { reason: "fraud", details: "Asked for money" } });
    const admin = await signInAdmin("Tobi");

    const open = await json<ReportsResponse>(await call("/v1/admin/reports", { token: admin.token }));
    const report = open.reports.find((r) => r.reported.id === man.id)!;
    expect(report).toMatchObject({
      reason: "fraud",
      details: "Asked for money",
      reporter: { firstName: "Ifeoma" },
      reported: { firstName: "Segun", openReports: 1 },
    });

    const resolve = (outcome: string) =>
      call(`/v1/admin/reports/${report.id}/resolve`, { token: admin.token, json: { outcome, note: "Warned him" } });
    expect((await resolve("actioned")).status).toBe(204);
    await expectError(await resolve("dismissed"), 409, "already_resolved");

    const actioned = await json<ReportsResponse>(await call("/v1/admin/reports?status=actioned", { token: admin.token }));
    expect(actioned.reports.find((r) => r.id === report.id)).toMatchObject({ resolvedBy: "Tobi", resolutionNote: "Warned him" });
  });
});

describe("members", () => {
  it("finds members by name or email and shows everything about one", async () => {
    const city = uniqueCity();
    const member = await activeMember({ firstName: "Zainab", gender: "woman", city });
    const admin = await signInAdmin();

    const byName = await json<MembersResponse>(await call("/v1/admin/members?q=zainab", { token: admin.token }));
    expect(byName.members.some((m) => m.id === member.id)).toBe(true);
    const { email } = (await expectMe(await call("/v1/me", { token: member.token }))).user;
    const byEmail = await json<MembersResponse>(await call(`/v1/admin/members?q=${encodeURIComponent(email!)}`, { token: admin.token }));
    expect(byEmail.members.map((m) => m.id)).toEqual([member.id]);

    const detail = await json<MemberDetail>(await call(`/v1/admin/members/${member.id}`, { token: admin.token }));
    expect(detail.member).toMatchObject({ firstName: "Zainab", city, status: "active", email });
    expect(detail.photoKeys).toHaveLength(2);
    expect(detail.profile).toMatchObject({ maritalStatus: "divorced", occupation: "Teacher" });
    expect(detail.profile?.publishedAt).toBeTypeOf("number");
    expect(detail.checks.map((c) => c.kind)).toContain("liveness");
    expect(detail.history.map((h) => h.action)).toContain("verification_passed");
  });

  it("suspending signs the member out and hides them; restoring lets them back in", async () => {
    const city = uniqueCity();
    const woman = await activeMember({ firstName: "Halima", gender: "woman", city });
    const man = await activeMember({ firstName: "Musa", gender: "man", city });
    const { email } = (await expectMe(await call("/v1/me", { token: man.token }))).user;
    const admin = await signInAdmin("Ada Admin");

    await expectError(await call(`/v1/admin/members/${man.id}/suspend`, { token: admin.token, json: { reason: "" } }), 400, "invalid_request");
    expect((await call(`/v1/admin/members/${man.id}/suspend`, { token: admin.token, json: { reason: "Scam reports" } })).status).toBe(204);

    await expectError(await call("/v1/me", { token: man.token }), 401, "unauthorized");
    await expectError(await call(`/v1/members/${man.id}`, { token: woman.token }), 404, "not_found");
    // Age the sign-in code from a moment ago past the resend wait, then try to sign in again.
    await env.DB.prepare("UPDATE otp_challenges SET created_at = created_at - 120000 WHERE destination = ?").bind(email).run();
    expect((await call("/v1/auth/otp/request", { json: { channel: "email", to: email } })).status).toBe(200);
    await expectError(await call("/v1/auth/otp/verify", { json: { channel: "email", to: email, code: FIXED_CODE } }), 403, "account_suspended");
    await expectError(await call(`/v1/admin/members/${man.id}/suspend`, { token: admin.token, json: { reason: "Again" } }), 409, "cannot_suspend");

    expect((await call(`/v1/admin/members/${man.id}/restore`, { token: admin.token, json: { note: "Appeal accepted" } })).status).toBe(204);
    const detail = await json<MemberDetail>(await call(`/v1/admin/members/${man.id}`, { token: admin.token }));
    expect(detail.member.status).toBe("active");
    expect(detail.history.slice(0, 2)).toMatchObject([
      { action: "member_restored", note: "Appeal accepted", adminName: "Ada Admin" },
      { action: "member_suspended", note: "Scam reports", adminName: "Ada Admin" },
    ]);
    expect((await call(`/v1/members/${man.id}`, { token: woman.token })).status).toBe(200);
  });
});

describe("payments and overview", () => {
  it("lists payments with totals and active plans, and counts what needs attention", async () => {
    const man = await activeMember({ firstName: "Chidi", gender: "man", city: uniqueCity() });
    const checkout = (await (
      await call("/v1/billing/checkout", {
        token: man.token,
        json: { plan: "monthly", email: "chidi@example.com", returnUrl: "icecream://billing-return" },
      })
    ).json()) as CheckoutResponse;
    const url = new URL(checkout.checkoutUrl);
    expect((await call(`/v1/billing/fake-checkout/${checkout.reference}/pay${url.search}`, { method: "POST" })).status).toBe(200);
    const admin = await signInAdmin();

    const payments = await json<PaymentsResponse>(await call("/v1/admin/payments", { token: admin.token }));
    expect(payments.payments.find((p) => p.reference === checkout.reference)).toMatchObject({
      plan: "monthly",
      status: "paid",
      amountKobo: 500_000,
      member: { id: man.id, firstName: "Chidi" },
    });
    expect(payments.totals.paidThisMonthKobo).toBeGreaterThanOrEqual(500_000);
    expect(payments.activeSubscriptions.monthly).toBeGreaterThanOrEqual(1);

    const overview = await json<Overview>(await call("/v1/admin/overview", { token: admin.token }));
    expect(overview.members.active).toBeGreaterThanOrEqual(1);
    expect(overview.activeSubscriptions).toBeGreaterThanOrEqual(1);
    expect(overview.revenueThisMonthKobo).toBeGreaterThanOrEqual(500_000);
  });
});
