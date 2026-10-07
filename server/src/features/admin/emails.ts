import type { EmailAudience } from "../../../../contracts";
import { createRouter } from "../../lib/app";
import { safeEqual } from "../../lib/crypto";
import { emailLayout, escapeHtml, sendEmail } from "../../lib/mailer";

/** Bulk emails sent per background run (every minute in production). */
const BATCH_SIZE = 20;
/** A send that started this long ago without finishing (the run was cut off) is tried again. */
const STUCK_AFTER_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

/** How many bulk emails may go out in 24 hours, leaving the rest of the mail account's allowance for sign-in codes. */
export const dailyLimit = (env: Env) => Number(env.EMAIL_DAILY_LIMIT) || 400;

// ---- Writing the email ----

/** {name} becomes the member's first name ("there" if they haven't given one yet). */
export const personalise = (text: string, firstName: string | null) => text.replace(/\{name\}/g, firstName?.trim() || "there");

type TeamEmail = { subject: string; body: string; firstName: string | null; unsubscribeUrl?: string };

/** A message from the team in the icecream frame. Bulk announcements carry an unsubscribe link. */
export function renderTeamEmail({ subject, body, firstName, unsubscribeUrl }: TeamEmail) {
  const message = personalise(body, firstName).trim();
  const paragraphs = message
    .split(/\n\s*\n/)
    .map((p) => `<p style="font-size:16px;line-height:24px;margin:16px 0 0">${escapeHtml(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const signOff = `<p style="font-size:16px;line-height:24px;margin:24px 0 0;color:#5F5751">The icecream team</p>`;
  const footer = unsubscribeUrl
    ? `You’re receiving this because you have an icecream account.<br><a href="${escapeHtml(unsubscribeUrl)}" style="color:#A39A92">Unsubscribe from announcements</a>`
    : undefined;

  const text = [message, "", "The icecream team", ...(unsubscribeUrl ? ["", `Unsubscribe from announcements: ${unsubscribeUrl}`] : [])].join("\n");
  return {
    subject: personalise(subject, firstName),
    text,
    html: emailLayout(paragraphs + signOff, footer),
    headers: unsubscribeUrl
      ? { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
      : undefined,
  };
}

// ---- Unsubscribe links ----

async function hmacHex(key: string, message: string) {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** A link only this member can use, so nobody can unsubscribe someone else by guessing. */
export async function unsubscribeUrl(env: Env, base: string, userId: string) {
  const token = await hmacHex(env.OTP_PEPPER, `unsubscribe:${userId}`);
  return `${base}/v1/email/unsubscribe?u=${encodeURIComponent(userId)}&t=${token}`;
}

// ---- Who gets a bulk email ----

/** SQL conditions for an audience, on users aliased `u`. Never includes suspended or under-35 members. */
export function audienceWhere(audience: EmailAudience): { sql: string; binds: unknown[] } {
  const where = ["u.email IS NOT NULL"];
  const binds: unknown[] = [];
  where.push(audience.status === "everyone" ? "u.status IN ('active', 'onboarding')" : "u.status = ?");
  if (audience.status !== "everyone") binds.push(audience.status);
  if (audience.gender) {
    where.push("u.gender = ?");
    binds.push(audience.gender);
  }
  if (audience.city?.trim()) {
    where.push("LOWER(u.city) = LOWER(?)");
    binds.push(audience.city.trim());
  }
  if (audience.plan) {
    where.push(`${audience.plan === "with" ? "" : "NOT "}EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = u.id AND s.current_period_end > ?)`);
    binds.push(Date.now());
  }
  return { sql: where.join(" AND "), binds };
}

// ---- Sending in the background ----

/** Bulk emails sent in the last 24 hours. */
export async function bulkSentToday(db: D1Database, now = Date.now()) {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM email_outbox o JOIN email_campaigns c ON c.id = o.campaign_id
       WHERE c.kind = 'bulk' AND o.status = 'sent' AND o.sent_at > ?`,
    )
    .bind(now - DAY_MS)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

type Claimed = { id: string; campaign_id: string; user_id: string | null; email: string; first_name: string | null; attempts: number };

/**
 * Sends the next few queued bulk emails, staying under the daily limit. Safe to run at the same time
 * as itself: each email is claimed by one run before it's sent. Runs every minute in production, and
 * also straight after a bulk email is created and whenever the team opens the Emails page.
 */
export async function processOutbox(env: Env, now = Date.now()): Promise<{ sent: number; failed: number }> {
  const db = env.DB;
  // Sends cut off part-way (e.g. the run was stopped) go back in the queue, or fail after a few tries.
  await db.batch([
    db
      .prepare("UPDATE email_outbox SET status = 'queued' WHERE status = 'sending' AND claimed_at < ? AND attempts < ?")
      .bind(now - STUCK_AFTER_MS, MAX_ATTEMPTS),
    db
      .prepare("UPDATE email_outbox SET status = 'failed', error = 'Sending was interrupted too many times.' WHERE status = 'sending' AND claimed_at < ?")
      .bind(now - STUCK_AFTER_MS),
  ]);

  const room = Math.min(BATCH_SIZE, dailyLimit(env) - (await bulkSentToday(db, now)));
  if (room <= 0) return { sent: 0, failed: 0 };

  const { results: claimed } = await db
    .prepare(
      `UPDATE email_outbox SET status = 'sending', claimed_at = ?, attempts = attempts + 1
       WHERE status = 'queued' AND id IN (SELECT id FROM email_outbox WHERE status = 'queued' ORDER BY created_at LIMIT ?)
       RETURNING id, campaign_id, user_id, email, first_name, attempts`,
    )
    .bind(now, room)
    .all<Claimed>();

  let sent = 0;
  let failed = 0;
  const campaigns = new Map<string, { kind: string; subject: string; body: string; link_base: string | null } | null>();
  for (const item of claimed) {
    if (!campaigns.has(item.campaign_id)) {
      campaigns.set(
        item.campaign_id,
        await db.prepare("SELECT kind, subject, body, link_base FROM email_campaigns WHERE id = ?").bind(item.campaign_id).first(),
      );
    }
    const campaign = campaigns.get(item.campaign_id);
    // Skipped if the member deleted their account, or (for announcements) unsubscribed or was suspended
    // after it was queued. A single email to one member is about their account, so it still goes.
    const member = item.user_id
      ? await db
          .prepare("SELECT status, announcements_opt_out_at FROM users WHERE id = ?")
          .bind(item.user_id)
          .first<{ status: string; announcements_opt_out_at: number | null }>()
      : null;
    const bulk = campaign?.kind === "bulk";
    if (!campaign || !member || (bulk && (member.announcements_opt_out_at || member.status === "suspended"))) {
      await db.prepare("UPDATE email_outbox SET status = 'skipped' WHERE id = ?").bind(item.id).run();
      continue;
    }

    try {
      const link = campaign.link_base ? await unsubscribeUrl(env, campaign.link_base, item.user_id!) : undefined;
      await sendEmail(env, {
        to: item.email,
        ...renderTeamEmail({ subject: campaign.subject, body: campaign.body, firstName: item.first_name, unsubscribeUrl: link }),
      });
      await db.prepare("UPDATE email_outbox SET status = 'sent', sent_at = ?, error = NULL WHERE id = ?").bind(Date.now(), item.id).run();
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const giveUp = item.attempts >= MAX_ATTEMPTS;
      await db
        .prepare("UPDATE email_outbox SET status = ?, error = ? WHERE id = ?")
        .bind(giveUp ? "failed" : "queued", message.slice(0, 300), item.id)
        .run();
      if (giveUp) failed += 1;
    }
  }
  return { sent, failed };
}

// ---- The unsubscribe page members land on ----

function page(title: string, body: string) {
  return emailLayout(`
    <h1 style="font-size:22px;margin:20px 0 8px">${title}</h1>
    ${body}`).replace("<html>", '<html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>icecream</title></head>');
}

async function validLink(env: Env, userId: string | undefined, token: string | undefined) {
  if (!userId || !token) return false;
  return safeEqual(token, await hmacHex(env.OTP_PEPPER, `unsubscribe:${userId}`));
}

const invalid = () =>
  page("This link doesn’t work", `<p style="font-size:16px;line-height:24px;color:#5F5751">It may have been copied incompletely. Try the link in the email again.</p>`);

/** Public: the unsubscribe link in bulk emails. Mounted at /v1/email. */
export const emailLinkRoutes = createRouter()
  // Opening the link asks first, so a mail scanner following links can't unsubscribe anyone.
  .get("/unsubscribe", async (c) => {
    const { u, t, test } = c.req.query();
    // The link in a test email the team sent themselves.
    if (test) {
      return c.html(
        page("This is where members unsubscribe", `<p style="font-size:16px;line-height:24px;color:#5F5751">In the real email, each member’s link takes them here to stop getting announcements.</p>`),
      );
    }
    if (!(await validLink(c.env, u, t))) return c.html(invalid(), 400);
    return c.html(
      page(
        "Unsubscribe from announcements?",
        `<p style="font-size:16px;line-height:24px;color:#5F5751">You’ll stop getting news and updates from the icecream team. You’ll still get emails about your own account, like sign-in codes.</p>
         <form method="post" style="margin-top:24px">
           <button type="submit" style="font:inherit;font-weight:700;font-size:16px;background:#9E3D48;color:#fff;border:0;border-radius:12px;padding:14px 24px;cursor:pointer">Unsubscribe</button>
         </form>`,
      ),
    );
  })
  // The button above, and one-click unsubscribe from mail apps (List-Unsubscribe-Post).
  .post("/unsubscribe", async (c) => {
    const { u, t } = c.req.query();
    if (!(await validLink(c.env, u, t))) return c.html(invalid(), 400);
    await c.env.DB.prepare("UPDATE users SET announcements_opt_out_at = COALESCE(announcements_opt_out_at, ?) WHERE id = ?")
      .bind(Date.now(), u)
      .run();
    return c.html(
      page("You’re unsubscribed", `<p style="font-size:16px;line-height:24px;color:#5F5751">You won’t get announcements from icecream any more.</p>`),
    );
  });
