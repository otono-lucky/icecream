import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AudiencePreview, EmailCampaignDetail, EmailCampaignsResponse, MemberDetail } from "../../contracts";
import { bulkSentToday, processOutbox, unsubscribeUrl } from "../src/features/admin/emails";

import { activeMember, call, expectError, expectMe, signInAdmin, signUpToLiveness } from "./helpers";

const uniqueCity = () => `Mailton ${Math.random().toString(36).slice(2, 8)}`;
const json = async <T>(response: Response) => {
  expect(response.status, await response.clone().text()).toBe(200);
  return (await response.json()) as T;
};

/** Everything the console email provider "sent" during the test. */
function captureEmails() {
  const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
  return () => log.mock.calls.map((args) => String(args[0])).filter((line) => line.startsWith("[email] To "));
}

afterEach(() => {
  vi.restoreAllMocks();
});

/** Runs the background sender until nothing for this email is waiting. */
async function sendAll(token: string, id: string) {
  for (let i = 0; i < 10; i++) {
    const detail = await json<EmailCampaignDetail>(await call(`/v1/admin/emails/${id}`, { token }));
    if (detail.counts.queued === 0) return detail;
    await processOutbox(env);
  }
  throw new Error("Emails still queued");
}

describe("an email to one member", () => {
  it("sends straight away with their name, and shows in their history", async () => {
    const sent = captureEmails();
    const member = await activeMember({ firstName: "Folake", gender: "woman", city: uniqueCity() });
    const { email } = (await expectMe(await call("/v1/me", { token: member.token }))).user;
    const admin = await signInAdmin("Bisi");

    const response = await call(`/v1/admin/members/${member.id}/email`, {
      token: admin.token,
      json: { subject: "About your photos", body: "Hello {name},\n\nPlease add one more photo." },
    });
    expect(response.status).toBe(204);
    const mail = sent().find((line) => line.includes(email!) && !line.includes("sign-in code"))!;
    expect(mail).toContain("About your photos");
    expect(mail).toContain("Hello Folake,");
    // About their account, so no unsubscribe link.
    expect(mail).not.toContain("Unsubscribe");

    const detail = await json<MemberDetail>(await call(`/v1/admin/members/${member.id}`, { token: admin.token }));
    expect(detail.history[0]).toMatchObject({ action: "email_sent", note: "About your photos", adminName: "Bisi" });
    const list = await json<EmailCampaignsResponse>(await call("/v1/admin/emails", { token: admin.token }));
    expect(list.campaigns.find((c) => c.subject === "About your photos")).toMatchObject({
      kind: "single",
      counts: { sent: 1 },
      recipient: { id: member.id, firstName: "Folake" },
    });
  });

  it("needs a subject and a message, and a member that exists", async () => {
    const admin = await signInAdmin();
    const member = await activeMember({ firstName: "Kunle", gender: "man", city: uniqueCity() });
    await expectError(
      await call(`/v1/admin/members/${member.id}/email`, { token: admin.token, json: { subject: " ", body: "Hi" } }),
      400,
      "invalid_request",
    );
    await expectError(
      await call("/v1/admin/members/nobody/email", { token: admin.token, json: { subject: "Hi", body: "Hi" } }),
      404,
      "not_found",
    );
  });
});

describe("bulk emails", () => {
  it("previews who matches, by status, gender, city and plan", async () => {
    const city = uniqueCity();
    const woman = await activeMember({ firstName: "Ijeoma", gender: "woman", city });
    await activeMember({ firstName: "Tayo", gender: "man", city });
    const signingUp = await signUpToLiveness();
    await call("/v1/me/details", { method: "PUT", token: signingUp, json: { firstName: "Ada", gender: "woman", city } });
    // Suspended members never get announcements.
    const suspended = await activeMember({ firstName: "Gbenga", gender: "man", city });
    const admin = await signInAdmin();
    await call(`/v1/admin/members/${suspended.id}/suspend`, { token: admin.token, json: { reason: "Test" } });

    const preview = async (audience: object) =>
      json<AudiencePreview>(await call("/v1/admin/emails/preview", { token: admin.token, json: { status: "everyone", city, ...audience } }));
    expect(await preview({})).toEqual({ count: 3, unsubscribed: 0 });
    expect((await preview({ status: "active" })).count).toBe(2);
    expect((await preview({ status: "onboarding" })).count).toBe(1);
    expect((await preview({ gender: "woman" })).count).toBe(2);
    expect((await preview({ city: city.toUpperCase() })).count).toBe(3);
    expect((await preview({ plan: "with" })).count).toBe(0);
    expect((await preview({ plan: "without" })).count).toBe(3);

    // Unsubscribing moves a member from "count" to "unsubscribed".
    const link = new URL(await unsubscribeUrl(env, "http://api.test", woman.id));
    expect((await call(`${link.pathname}${link.search}`, { method: "POST" })).status).toBe(200);
    expect(await preview({})).toEqual({ count: 2, unsubscribed: 1 });
    const detail = await json<MemberDetail>(await call(`/v1/admin/members/${woman.id}`, { token: admin.token }));
    expect(detail.member.unsubscribedAt).toBeTypeOf("number");
  });

  it("queues an announcement, sends it to each member by name with an unsubscribe link, and records the result", async () => {
    const sent = captureEmails();
    const city = uniqueCity();
    await activeMember({ firstName: "Nneka", gender: "woman", city });
    await activeMember({ firstName: "Bola", gender: "woman", city });
    await activeMember({ firstName: "Chinedu", gender: "man", city });
    const admin = await signInAdmin("Bisi");

    const { id } = await json<{ id: string }>(
      await call("/v1/admin/emails/bulk", {
        token: admin.token,
        json: { subject: "News for {name}", body: "Hi {name}, we’ve added new features.", audience: { status: "active", city, gender: "woman" } },
      }),
    );
    const detail = await sendAll(admin.token, id);
    expect(detail).toMatchObject({ kind: "bulk", recipientCount: 2, counts: { sent: 2, failed: 0, queued: 0 }, sentBy: "Bisi" });
    expect(detail.audience).toEqual({ status: "active", city, gender: "woman" });
    expect(detail.recipients.map((r) => r.firstName).sort()).toEqual(["Bola", "Nneka"]);

    const nneka = sent().find((line) => line.includes("News for Nneka"))!;
    expect(nneka).toContain("Hi Nneka, we’ve added new features.");
    expect(nneka).toMatch(/Unsubscribe from announcements: http:\/\/api\.test\/v1\/email\/unsubscribe\?u=.+&t=[0-9a-f]{64}/);
    expect(sent().some((line) => line.includes("Chinedu"))).toBe(false);
  });

  it("refuses an announcement nobody would get", async () => {
    const admin = await signInAdmin();
    await expectError(
      await call("/v1/admin/emails/bulk", {
        token: admin.token,
        json: { subject: "Hi", body: "Hi", audience: { status: "active", city: uniqueCity() } },
      }),
      400,
      "no_recipients",
    );
  });

  it("skips members who unsubscribe after it's queued", async () => {
    const city = uniqueCity();
    const member = await activeMember({ firstName: "Uche", gender: "man", city });
    const admin = await signInAdmin();
    // Queue it directly, so the unsubscribe lands before the background sender gets to it.
    const now = Date.now();
    const campaignId = `c-${now}`;
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO email_campaigns (id, admin_id, kind, subject, body, link_base, recipient_count, created_at) VALUES (?, ?, 'bulk', 'Hi', 'Hi', 'http://api.test', 1, ?)",
      ).bind(campaignId, admin.id, now),
      env.DB.prepare("INSERT INTO email_outbox (id, campaign_id, user_id, email, first_name, created_at) VALUES (?, ?, ?, 'u@example.com', 'Uche', ?)").bind(
        `o-${now}`,
        campaignId,
        member.id,
        now,
      ),
    ]);
    const link = new URL(await unsubscribeUrl(env, "http://api.test", member.id));
    await call(`${link.pathname}${link.search}`, { method: "POST" });

    const detail = await sendAll(admin.token, campaignId);
    expect(detail.counts).toMatchObject({ sent: 0, skipped: 1 });
  });

  it("stays within the daily limit", async () => {
    const admin = await signInAdmin();
    const now = Date.now();
    const campaignId = `limit-${now}`;
    await env.DB.prepare(
      "INSERT INTO email_campaigns (id, admin_id, kind, subject, body, recipient_count, created_at) VALUES (?, ?, 'bulk', 'Hi', 'Hi', 3, ?)",
    )
      .bind(campaignId, admin.id, now)
      .run();
    for (let i = 0; i < 3; i++) {
      const member = await activeMember({ firstName: `Limit${i}`, gender: "woman", city: uniqueCity() });
      await env.DB.prepare("INSERT INTO email_outbox (id, campaign_id, user_id, email, first_name, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(`limit-${now}-${i}`, campaignId, member.id, `limit${i}@example.com`, `Limit${i}`, now)
        .run();
    }
    // Counted directly: opening the Emails list would start sending these.
    const sentToday = await bulkSentToday(env.DB);
    // Room for exactly one more today.
    const limited = { ...env, EMAIL_DAILY_LIMIT: String(sentToday + 1) } as Env;
    expect((await processOutbox(limited)).sent).toBe(1);
    expect((await processOutbox(limited)).sent).toBe(0);
  });
});

describe("unsubscribe links", () => {
  it("asks before unsubscribing, and refuses a tampered link", async () => {
    const member = await activeMember({ firstName: "Sade", gender: "woman", city: uniqueCity() });
    const link = new URL(await unsubscribeUrl(env, "http://api.test", member.id));

    const ask = await call(`${link.pathname}${link.search}`);
    expect(ask.status).toBe(200);
    const page = await ask.text();
    expect(page).toContain("Unsubscribe from announcements?");
    expect(page).toContain('<form method="post"');

    const tampered = `${link.pathname}?u=${encodeURIComponent(member.id)}&t=${"0".repeat(64)}`;
    expect((await call(tampered, { method: "POST" })).status).toBe(400);
    const row = await env.DB.prepare("SELECT announcements_opt_out_at FROM users WHERE id = ?").bind(member.id).first();
    expect(row?.announcements_opt_out_at).toBeNull();
  });
});
