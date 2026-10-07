import { Hono } from "hono";
import { z } from "zod";

import {
  ageOn,
  PLAN_ORDER,
  todayUtc,
  type AdminAction,
  type AdminPayment,
  type AudiencePreview,
  type Check,
  type ChecksResponse,
  type EmailAudience,
  type EmailCampaign,
  type EmailCampaignDetail,
  type EmailCampaignsResponse,
  type EmailRecipient,
  MAX_EMAIL_BODY,
  MAX_EMAIL_SUBJECT,
  type MemberDetail,
  type MembersResponse,
  type MemberSummary,
  type Overview,
  type PaymentsResponse,
  type PlanId,
  type Report,
  type ReportsResponse,
  type UserStatus,
} from "../../../../contracts";
import { randomId } from "../../lib/crypto";
import { ApiError } from "../../lib/errors";
import { sendEmail } from "../../lib/mailer";
import { serveObject } from "../../lib/media";
import { parseJson } from "../../lib/validation";
import { toAnswers, type ProfileRow } from "../profile/profile";

import { requireAdmin, type AdminEnv } from "./auth";
import { audienceWhere, bulkSentToday, dailyLimit, processOutbox, renderTeamEmail } from "./emails";

// ---- Shared SQL and row mapping -------------------------------------------------------------------

/** The columns of a MemberSummary for the users row aliased `a`, each prefixed with `p`. */
const memberColumns = (a: string, p = "") =>
  `${a}.id AS ${p}id, ${a}.first_name AS ${p}first_name, ${a}.email AS ${p}email, ${a}.date_of_birth AS ${p}dob,
   ${a}.gender AS ${p}gender, ${a}.city AS ${p}city, ${a}.status AS ${p}status, ${a}.created_at AS ${p}created_at,
   (SELECT object_key FROM photos ph WHERE ph.user_id = ${a}.id ORDER BY position LIMIT 1) AS ${p}photo_key`;

type Row = Record<string, unknown>;

function toMember(row: Row, p = ""): MemberSummary {
  const dob = row[`${p}dob`] as string | null;
  return {
    id: row[`${p}id`] as string,
    firstName: row[`${p}first_name`] as string | null,
    email: row[`${p}email`] as string | null,
    age: dob ? ageOn(dob, todayUtc()) : null,
    gender: row[`${p}gender`] as MemberSummary["gender"],
    city: row[`${p}city`] as string | null,
    status: row[`${p}status`] as UserStatus,
    createdAt: row[`${p}created_at`] as number,
    photoKey: row[`${p}photo_key`] as string | null,
  };
}

const CHECK_COLUMNS = `v.id AS check_id, v.kind, v.status AS check_status, v.document_type, v.object_key, v.submitted_at,
  v.failure_reason, v.reviewed_at, COALESCE(ad.name, v.reviewed_by) AS reviewed_by_name`;

function toCheck(row: Row): Omit<Check, "member"> {
  return {
    id: row.check_id as string,
    kind: row.kind as Check["kind"],
    status: row.check_status as Check["status"],
    documentType: row.document_type as Check["documentType"],
    submissionKey: row.object_key as string,
    submittedAt: row.submitted_at as number,
    failureReason: row.failure_reason as string | null,
    reviewedAt: row.reviewed_at as number | null,
    reviewedBy: row.reviewed_by_name as string | null,
  };
}

const REPORT_COLUMNS = `r.id AS report_id, r.reason, r.details, r.status AS report_status, r.created_at AS report_created_at,
  r.resolved_at, r.resolution_note, ad.name AS resolved_by_name`;

function toReport(row: Row): Omit<Report, "reporter" | "reported"> {
  return {
    id: row.report_id as string,
    reason: row.reason as Report["reason"],
    details: row.details as string | null,
    status: row.report_status as Report["status"],
    createdAt: row.report_created_at as number,
    resolvedAt: row.resolved_at as number | null,
    resolvedBy: row.resolved_by_name as string | null,
    resolutionNote: row.resolution_note as string | null,
  };
}

function toPayment(row: Row): Omit<AdminPayment, "member"> {
  return {
    reference: row.reference as string,
    plan: row.plan as PlanId,
    amountKobo: row.amount_kobo as number,
    status: row.status as AdminPayment["status"],
    provider: row.provider as string,
    createdAt: row.created_at as number,
    paidAt: row.paid_at as number | null,
  };
}

/** Records an admin's decision, for the member's history and the team's accountability. */
const logAction = (
  db: D1Database,
  adminId: string,
  action: AdminAction["action"],
  targetUserId: string,
  targetId: string | null,
  note: string | null,
) =>
  db
    .prepare(
      "INSERT INTO admin_actions (id, admin_id, action, target_user_id, target_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(randomId(), adminId, action, targetUserId, targetId, note, Date.now());

const startOfMonthUtc = (now = new Date()) => Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);

const note = z.string().trim().max(500);

const draftSchema = z.object({
  subject: z.string().trim().min(1).max(MAX_EMAIL_SUBJECT),
  body: z.string().trim().min(1).max(MAX_EMAIL_BODY),
});

const audienceSchema = z.object({
  status: z.enum(["active", "onboarding", "everyone"]),
  gender: z.enum(["woman", "man"]).optional(),
  city: z.string().trim().max(80).optional(),
  plan: z.enum(["with", "without"]).optional(),
});

const CAMPAIGN_COLUMNS = `c.id, c.kind, c.subject, c.body, c.audience, c.recipient_count, c.created_at, a.name AS sent_by,
  (SELECT COUNT(*) FROM email_outbox o WHERE o.campaign_id = c.id AND o.status IN ('queued', 'sending')) AS queued,
  (SELECT COUNT(*) FROM email_outbox o WHERE o.campaign_id = c.id AND o.status = 'sent') AS sent,
  (SELECT COUNT(*) FROM email_outbox o WHERE o.campaign_id = c.id AND o.status = 'failed') AS failed,
  (SELECT COUNT(*) FROM email_outbox o WHERE o.campaign_id = c.id AND o.status = 'skipped') AS skipped,
  (SELECT o.user_id FROM email_outbox o WHERE o.campaign_id = c.id AND c.kind = 'single') AS recipient_id,
  (SELECT o.first_name FROM email_outbox o WHERE o.campaign_id = c.id AND c.kind = 'single') AS recipient_name`;

function toCampaign(row: Row): EmailCampaign {
  return {
    id: row.id as string,
    kind: row.kind as EmailCampaign["kind"],
    subject: row.subject as string,
    body: row.body as string,
    audience: row.audience ? (JSON.parse(row.audience as string) as EmailAudience) : null,
    recipientCount: row.recipient_count as number,
    createdAt: row.created_at as number,
    sentBy: row.sent_by as string,
    counts: { queued: row.queued as number, sent: row.sent as number, failed: row.failed as number, skipped: row.skipped as number },
    recipient: row.kind === "single" ? { id: row.recipient_id as string | null, firstName: row.recipient_name as string | null } : null,
  };
}

// ---- Routes ---------------------------------------------------------------------------------------

/** The admin website's API (PRD 3.10). Mounted at /v1/admin, after /v1/admin/auth. */
export const adminRoutes = new Hono<AdminEnv>()
  .use(requireAdmin)

  .get("/me", (c) => c.json(c.get("admin")))

  .get("/overview", async (c) => {
    const db = c.env.DB;
    const now = Date.now();
    const [checks, reports, statuses, subscriptions, revenue] = await db.batch<Row>([
      db.prepare("SELECT COUNT(*) AS n FROM verifications WHERE status = 'pending'"),
      db.prepare("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'"),
      db.prepare("SELECT status, COUNT(*) AS n FROM users GROUP BY status"),
      db.prepare("SELECT COUNT(*) AS n FROM subscriptions WHERE current_period_end > ?").bind(now),
      db.prepare("SELECT COALESCE(SUM(amount_kobo), 0) AS n FROM payments WHERE status = 'paid' AND paid_at >= ?").bind(startOfMonthUtc()),
    ]);
    const members: Overview["members"] = { onboarding: 0, active: 0, ineligible: 0, suspended: 0 };
    for (const row of statuses.results) members[row.status as UserStatus] = row.n as number;
    return c.json<Overview>({
      pendingChecks: checks.results[0].n as number,
      openReports: reports.results[0].n as number,
      members,
      activeSubscriptions: subscriptions.results[0].n as number,
      revenueThisMonthKobo: revenue.results[0].n as number,
    });
  })

  /** Photos, selfies and ID images, for any member. */
  .get("/media/*", async (c) => {
    const key = c.req.path.replace(/^.*\/media\//, "");
    return serveObject(c.env.MEDIA, decodeURIComponent(key));
  })

  // ---- Checks (selfie and ID verification) ----

  /**
   * Checks with a status, optionally narrowed by kind, the member's gender, and a search across first
   * name, email and city. Waiting checks are oldest first by default, reviewed ones newest first.
   */
  .get("/checks", async (c) => {
    const query = z
      .object({
        status: z.enum(["pending", "passed", "failed"]).catch("pending"),
        kind: z.enum(["liveness", "government_id"]).optional().catch(undefined),
        gender: z.enum(["woman", "man"]).optional().catch(undefined),
        q: z.string().trim().toLowerCase().max(100).optional().catch(undefined),
        sort: z.enum(["oldest", "newest"]).optional().catch(undefined),
      })
      .parse(c.req.query());
    const where = ["v.status = ?"];
    const binds: unknown[] = [query.status];
    if (query.kind) {
      where.push("v.kind = ?");
      binds.push(query.kind);
    }
    if (query.gender) {
      where.push("u.gender = ?");
      binds.push(query.gender);
    }
    if (query.q) {
      where.push("(LOWER(u.first_name) LIKE ? OR u.email LIKE ? OR LOWER(u.city) LIKE ?)");
      binds.push(`%${query.q}%`, `%${query.q}%`, `%${query.q}%`);
    }
    const sort = query.sort ?? (query.status === "pending" ? "oldest" : "newest");
    const when = query.status === "pending" ? "v.submitted_at" : "v.reviewed_at";
    const { results } = await c.env.DB.prepare(
      `SELECT ${CHECK_COLUMNS}, ${memberColumns("u")},
              (SELECT group_concat(object_key) FROM (SELECT object_key FROM photos p WHERE p.user_id = u.id ORDER BY position)) AS photo_keys
       FROM verifications v JOIN users u ON u.id = v.user_id LEFT JOIN admins ad ON ad.id = v.reviewed_by
       WHERE ${where.join(" AND ")}
       ORDER BY ${when} ${sort === "oldest" ? "ASC" : "DESC"} LIMIT 100`,
    )
      .bind(...binds)
      .all<Row>();
    return c.json<ChecksResponse>({
      checks: results.map((row) => ({
        ...toCheck(row),
        member: { ...toMember(row), photoKeys: (row.photo_keys as string | null)?.split(",") ?? [] },
      })),
    });
  })

  .post("/checks/:id/decision", async (c) => {
    const body = await parseJson(
      c,
      z.discriminatedUnion("decision", [
        z.object({ decision: z.literal("pass") }),
        z.object({ decision: z.literal("fail"), reason: z.string().trim().min(1).max(300) }),
      ]),
    );
    const id = c.req.param("id");
    const check = await c.env.DB.prepare("SELECT user_id, kind, status FROM verifications WHERE id = ?")
      .bind(id)
      .first<{ user_id: string; kind: string; status: string }>();
    if (!check) throw new ApiError(404, "not_found", "Check not found.");
    if (check.status !== "pending") throw new ApiError(409, "already_decided", "Someone has already reviewed this.");

    const admin = c.get("admin");
    const now = Date.now();
    const passed = body.decision === "pass";
    const reason = body.decision === "fail" ? body.reason : null;
    const statements = [
      c.env.DB.prepare(
        "UPDATE verifications SET status = ?, failure_reason = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ? AND status = 'pending'",
      ).bind(passed ? "passed" : "failed", reason, now, admin.id, id),
      logAction(c.env.DB, admin.id, passed ? "verification_passed" : "verification_failed", check.user_id, id, reason),
    ];
    // Passing the selfie check is what lets a member in (PRD 3.1: nobody browses until verification passes).
    if (check.kind === "liveness" && passed) {
      statements.push(
        c.env.DB.prepare("UPDATE users SET status = 'active', updated_at = ? WHERE id = ? AND status = 'onboarding'").bind(
          now,
          check.user_id,
        ),
      );
    }
    await c.env.DB.batch(statements);
    return c.body(null, 204);
  })

  // ---- Reports ----

  .get("/reports", async (c) => {
    const status = z.enum(["open", "actioned", "dismissed"]).catch("open").parse(c.req.query("status"));
    const { results } = await c.env.DB.prepare(
      `SELECT ${REPORT_COLUMNS}, ${memberColumns("reporter", "a_")}, ${memberColumns("reported", "b_")},
              (SELECT COUNT(*) FROM reports o WHERE o.reported_id = r.reported_id AND o.status = 'open') AS open_reports
       FROM reports r
       JOIN users reporter ON reporter.id = r.reporter_id
       JOIN users reported ON reported.id = r.reported_id
       LEFT JOIN admins ad ON ad.id = r.resolved_by
       WHERE r.status = ?
       ORDER BY ${status === "open" ? "r.created_at ASC" : "r.resolved_at DESC"} LIMIT 100`,
    )
      .bind(status)
      .all<Row>();
    return c.json<ReportsResponse>({
      reports: results.map((row) => ({
        ...toReport(row),
        reporter: toMember(row, "a_"),
        reported: { ...toMember(row, "b_"), openReports: row.open_reports as number },
      })),
    });
  })

  .post("/reports/:id/resolve", async (c) => {
    const body = await parseJson(c, z.object({ outcome: z.enum(["actioned", "dismissed"]), note: note.optional() }));
    const id = c.req.param("id");
    const report = await c.env.DB.prepare("SELECT reported_id, status FROM reports WHERE id = ?")
      .bind(id)
      .first<{ reported_id: string; status: string }>();
    if (!report) throw new ApiError(404, "not_found", "Report not found.");
    if (report.status !== "open") throw new ApiError(409, "already_resolved", "Someone has already dealt with this report.");

    const admin = c.get("admin");
    const text = body.note || null;
    await c.env.DB.batch([
      c.env.DB.prepare(
        "UPDATE reports SET status = ?, resolved_at = ?, resolved_by = ?, resolution_note = ? WHERE id = ? AND status = 'open'",
      ).bind(body.outcome, Date.now(), admin.id, text, id),
      logAction(c.env.DB, admin.id, body.outcome === "actioned" ? "report_actioned" : "report_dismissed", report.reported_id, id, text),
    ]);
    return c.body(null, 204);
  })

  // ---- Members ----

  /** Search by first name, email or member id. With no search, the newest members. */
  .get("/members", async (c) => {
    const q = (c.req.query("q") ?? "").trim().toLowerCase();
    const status = z.enum(["onboarding", "active", "ineligible", "suspended"]).optional().catch(undefined).parse(c.req.query("status"));
    const where: string[] = [];
    const binds: unknown[] = [];
    if (q) {
      where.push("(u.id = ? OR LOWER(u.first_name) LIKE ? OR u.email LIKE ?)");
      binds.push(q, `%${q}%`, `%${q}%`);
    }
    if (status) {
      where.push("u.status = ?");
      binds.push(status);
    }
    const { results } = await c.env.DB.prepare(
      `SELECT ${memberColumns("u")} FROM users u ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY u.created_at DESC LIMIT 50`,
    )
      .bind(...binds)
      .all<Row>();
    return c.json<MembersResponse>({ members: results.map((row) => toMember(row)) });
  })

  .get("/members/:id", async (c) => {
    const id = c.req.param("id");
    const db = c.env.DB;
    const user = await db
      .prepare(`SELECT ${memberColumns("u")}, u.phone, u.date_of_birth, u.announcements_opt_out_at FROM users u WHERE u.id = ?`)
      .bind(id)
      .first<Row>();
    if (!user) throw new ApiError(404, "not_found", "Member not found.");

    const [photos, profile, checks, subscription, payments, reports, counts, history] = await db.batch<Row>([
      db.prepare("SELECT object_key FROM photos WHERE user_id = ? ORDER BY position").bind(id),
      db.prepare("SELECT * FROM profiles WHERE user_id = ?").bind(id),
      db
        .prepare(
          `SELECT ${CHECK_COLUMNS} FROM verifications v LEFT JOIN admins ad ON ad.id = v.reviewed_by
           WHERE v.user_id = ? ORDER BY v.submitted_at DESC`,
        )
        .bind(id),
      db.prepare("SELECT plan, status, current_period_end FROM subscriptions WHERE user_id = ?").bind(id),
      db.prepare("SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").bind(id),
      db
        .prepare(
          `SELECT ${REPORT_COLUMNS}, ${memberColumns("reporter", "a_")}
           FROM reports r JOIN users reporter ON reporter.id = r.reporter_id LEFT JOIN admins ad ON ad.id = r.resolved_by
           WHERE r.reported_id = ? ORDER BY r.created_at DESC`,
        )
        .bind(id),
      db
        .prepare(
          `SELECT (SELECT COUNT(*) FROM reports WHERE reporter_id = ?1) AS reports_made,
                  (SELECT COUNT(*) FROM blocks WHERE blocked_id = ?1) AS blocked_by`,
        )
        .bind(id),
      db
        .prepare(
          `SELECT x.action, x.note, x.created_at, a.name AS admin_name FROM admin_actions x JOIN admins a ON a.id = x.admin_id
           WHERE x.target_user_id = ? ORDER BY x.created_at DESC LIMIT 100`,
        )
        .bind(id),
    ]);

    const profileRow = profile.results[0] as unknown as (ProfileRow & { published_at: number | null }) | undefined;
    const sub = subscription.results[0];
    return c.json<MemberDetail>({
      member: {
        ...toMember(user),
        phone: user.phone as string | null,
        dateOfBirth: user.date_of_birth as string | null,
        unsubscribedAt: user.announcements_opt_out_at as number | null,
      },
      photoKeys: photos.results.map((row) => row.object_key as string),
      profile: profileRow ? { ...toAnswers(profileRow), publishedAt: profileRow.published_at } : null,
      checks: checks.results.map(toCheck),
      subscription: sub
        ? { plan: sub.plan as PlanId, status: sub.status as "active" | "cancelled", currentPeriodEnd: sub.current_period_end as number }
        : null,
      payments: payments.results.map(toPayment),
      reportsAgainst: reports.results.map((row) => ({ ...toReport(row), reporter: toMember(row, "a_") })),
      reportsMade: counts.results[0].reports_made as number,
      blockedBy: counts.results[0].blocked_by as number,
      history: history.results.map((row) => ({
        action: row.action as AdminAction["action"],
        note: row.note as string | null,
        adminName: row.admin_name as string,
        createdAt: row.created_at as number,
      })),
    });
  })

  /** Suspending signs the member out everywhere and hides them from everyone (PRD 3.9). */
  .post("/members/:id/suspend", async (c) => {
    const { reason } = await parseJson(c, z.object({ reason: note.min(1) }));
    const id = c.req.param("id");
    const user = await c.env.DB.prepare("SELECT status FROM users WHERE id = ?").bind(id).first<{ status: UserStatus }>();
    if (!user) throw new ApiError(404, "not_found", "Member not found.");
    if (user.status !== "active" && user.status !== "onboarding") {
      throw new ApiError(409, "cannot_suspend", `This member is ${user.status} and can't be suspended.`);
    }
    const admin = c.get("admin");
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE users SET status = 'suspended', updated_at = ? WHERE id = ?").bind(Date.now(), id),
      c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id),
      logAction(c.env.DB, admin.id, "member_suspended", id, null, reason),
    ]);
    return c.body(null, 204);
  })

  /** Back to active if their selfie check passed, otherwise back into onboarding. */
  .post("/members/:id/restore", async (c) => {
    const body = await parseJson(c, z.object({ note: note.optional() }));
    const id = c.req.param("id");
    const user = await c.env.DB.prepare(
      `SELECT status, EXISTS (SELECT 1 FROM verifications WHERE user_id = ?1 AND kind = 'liveness' AND status = 'passed') AS verified
       FROM users WHERE id = ?1`,
    )
      .bind(id)
      .first<{ status: UserStatus; verified: number }>();
    if (!user) throw new ApiError(404, "not_found", "Member not found.");
    if (user.status !== "suspended") throw new ApiError(409, "not_suspended", "This member isn't suspended.");
    const admin = c.get("admin");
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE users SET status = ?, updated_at = ? WHERE id = ?").bind(
        user.verified ? "active" : "onboarding",
        Date.now(),
        id,
      ),
      logAction(c.env.DB, admin.id, "member_restored", id, null, body.note || null),
    ]);
    return c.body(null, 204);
  })

  /** An email to one member, about their account. Sent straight away, so the team sees if it failed. */
  .post("/members/:id/email", async (c) => {
    const draft = await parseJson(c, draftSchema);
    const id = c.req.param("id");
    const member = await c.env.DB.prepare("SELECT email, first_name FROM users WHERE id = ?")
      .bind(id)
      .first<{ email: string | null; first_name: string | null }>();
    if (!member) throw new ApiError(404, "not_found", "Member not found.");
    if (!member.email) throw new ApiError(409, "no_email", "This member has no email address.");

    const admin = c.get("admin");
    const now = Date.now();
    const campaignId = randomId();
    const outboxId = randomId();
    await c.env.DB.batch([
      c.env.DB.prepare(
        "INSERT INTO email_campaigns (id, admin_id, kind, subject, body, recipient_count, created_at) VALUES (?, ?, 'single', ?, ?, 1, ?)",
      ).bind(campaignId, admin.id, draft.subject, draft.body, now),
      c.env.DB.prepare(
        `INSERT INTO email_outbox (id, campaign_id, user_id, email, first_name, status, attempts, created_at, claimed_at)
         VALUES (?, ?, ?, ?, ?, 'sending', 1, ?, ?)`,
      ).bind(outboxId, campaignId, id, member.email, member.first_name, now, now),
    ]);
    try {
      await sendEmail(c.env, { to: member.email, ...renderTeamEmail({ ...draft, firstName: member.first_name }) });
    } catch (error) {
      await c.env.DB.prepare("UPDATE email_outbox SET status = 'failed', error = ? WHERE id = ?")
        .bind(error instanceof Error ? error.message.slice(0, 300) : "Failed", outboxId)
        .run();
      throw error;
    }
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE email_outbox SET status = 'sent', sent_at = ? WHERE id = ?").bind(Date.now(), outboxId),
      logAction(c.env.DB, admin.id, "email_sent", id, campaignId, draft.subject),
    ]);
    return c.body(null, 204);
  })

  // ---- Emails ----

  /** How many members a bulk email would reach with these filters. */
  .post("/emails/preview", async (c) => {
    const audience = await parseJson(c, audienceSchema);
    const { sql, binds } = audienceWhere(audience);
    const row = await c.env.DB.prepare(
      `SELECT SUM(u.announcements_opt_out_at IS NULL) AS count, SUM(u.announcements_opt_out_at IS NOT NULL) AS unsubscribed
       FROM users u WHERE ${sql}`,
    )
      .bind(...binds)
      .first<{ count: number | null; unsubscribed: number | null }>();
    return c.json<AudiencePreview>({ count: row?.count ?? 0, unsubscribed: row?.unsubscribed ?? 0 });
  })

  /** Sends the draft to the admin's own address, as a member with their name would see it. */
  .post("/emails/test", async (c) => {
    const draft = await parseJson(c, draftSchema);
    const admin = c.get("admin");
    const link = `${new URL(c.req.url).origin}/v1/email/unsubscribe?test=1`;
    const email = renderTeamEmail({ ...draft, firstName: admin.name.split(" ")[0], unsubscribeUrl: link });
    await sendEmail(c.env, { to: admin.email, ...email, subject: `[Test] ${email.subject}` });
    return c.json({ sentTo: admin.email });
  })

  /** Queues an announcement to everyone matching the filters. It goes out a few at a time. */
  .post("/emails/bulk", async (c) => {
    const body = await parseJson(c, draftSchema.extend({ audience: audienceSchema }));
    const { sql, binds } = audienceWhere(body.audience);
    const admin = c.get("admin");
    const now = Date.now();
    const id = randomId();
    const db = c.env.DB;
    const count = await db
      .prepare(`SELECT COUNT(*) AS n FROM users u WHERE ${sql} AND u.announcements_opt_out_at IS NULL`)
      .bind(...binds)
      .first<{ n: number }>();
    if (!count?.n) throw new ApiError(400, "no_recipients", "Nobody matches these filters.");

    await db.batch([
      db
        .prepare(
          `INSERT INTO email_campaigns (id, admin_id, kind, subject, body, audience, link_base, recipient_count, created_at)
           VALUES (?, ?, 'bulk', ?, ?, ?, ?, 0, ?)`,
        )
        .bind(id, admin.id, body.subject, body.body, JSON.stringify(body.audience), new URL(c.req.url).origin, now),
      db
        .prepare(
          `INSERT INTO email_outbox (id, campaign_id, user_id, email, first_name, created_at)
           SELECT lower(hex(randomblob(16))), ?, u.id, u.email, u.first_name, ?
           FROM users u WHERE ${sql} AND u.announcements_opt_out_at IS NULL`,
        )
        .bind(id, now, ...binds),
      db.prepare("UPDATE email_campaigns SET recipient_count = (SELECT COUNT(*) FROM email_outbox WHERE campaign_id = ?) WHERE id = ?").bind(id, id),
    ]);
    // Start sending now rather than waiting for the next scheduled run.
    c.executionCtx.waitUntil(processOutbox(c.env));
    return c.json({ id });
  })

  .get("/emails", async (c) => {
    // Keeps queued emails moving even where the every-minute schedule doesn't run (local development).
    c.executionCtx.waitUntil(processOutbox(c.env));
    const { results } = await c.env.DB.prepare(
      `SELECT ${CAMPAIGN_COLUMNS} FROM email_campaigns c JOIN admins a ON a.id = c.admin_id ORDER BY c.created_at DESC LIMIT 100`,
    ).all<Row>();
    return c.json<EmailCampaignsResponse>({
      campaigns: results.map(toCampaign),
      sentToday: await bulkSentToday(c.env.DB),
      dailyLimit: dailyLimit(c.env),
    });
  })

  .get("/emails/:id", async (c) => {
    const id = c.req.param("id");
    const db = c.env.DB;
    const row = await db
      .prepare(`SELECT ${CAMPAIGN_COLUMNS} FROM email_campaigns c JOIN admins a ON a.id = c.admin_id WHERE c.id = ?`)
      .bind(id)
      .first<Row>();
    if (!row) throw new ApiError(404, "not_found", "Email not found.");
    const { results } = await db
      .prepare(
        `SELECT user_id, first_name, email, status, error, sent_at FROM email_outbox WHERE campaign_id = ?
         ORDER BY CASE status WHEN 'failed' THEN 0 WHEN 'sending' THEN 1 WHEN 'queued' THEN 2 ELSE 3 END, created_at LIMIT 500`,
      )
      .bind(id)
      .all<Row>();
    return c.json<EmailCampaignDetail>({
      ...toCampaign(row),
      recipients: results.map(
        (r): EmailRecipient => ({
          userId: r.user_id as string | null,
          firstName: r.first_name as string | null,
          email: r.email as string,
          status: r.status as EmailRecipient["status"],
          error: r.error as string | null,
          sentAt: r.sent_at as number | null,
        }),
      ),
    });
  })

  // ---- Payments ----

  .get("/payments", async (c) => {
    const status = z.enum(["pending", "paid", "failed"]).optional().catch(undefined).parse(c.req.query("status"));
    const db = c.env.DB;
    const [payments, totals, plans] = await db.batch<Row>([
      db
        .prepare(
          `SELECT p.*, u.first_name FROM payments p JOIN users u ON u.id = p.user_id
           ${status ? "WHERE p.status = ?" : ""} ORDER BY p.created_at DESC LIMIT 200`,
        )
        .bind(...(status ? [status] : [])),
      db
        .prepare(
          `SELECT COALESCE(SUM(amount_kobo), 0) AS all_time, COUNT(*) AS paid_count,
                  COALESCE(SUM(CASE WHEN paid_at >= ? THEN amount_kobo END), 0) AS this_month
           FROM payments WHERE status = 'paid'`,
        )
        .bind(startOfMonthUtc()),
      db.prepare("SELECT plan, COUNT(*) AS n FROM subscriptions WHERE current_period_end > ? GROUP BY plan").bind(Date.now()),
    ]);
    const activeSubscriptions = Object.fromEntries(PLAN_ORDER.map((plan) => [plan, 0])) as Record<PlanId, number>;
    for (const row of plans.results) activeSubscriptions[row.plan as PlanId] = row.n as number;
    const total = totals.results[0];
    return c.json<PaymentsResponse>({
      payments: payments.results.map((row) => ({
        ...toPayment(row),
        member: { id: row.user_id as string, firstName: row.first_name as string | null },
      })),
      totals: {
        paidAllTimeKobo: total.all_time as number,
        paidThisMonthKobo: total.this_month as number,
        paidCount: total.paid_count as number,
      },
      activeSubscriptions,
    });
  });
