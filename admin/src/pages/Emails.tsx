import type { EmailCampaign, EmailCampaignDetail, EmailCampaignsResponse } from "@contracts";
import { useEffect } from "react";

import { api } from "../api";
import { describeAudience } from "../labels";
import { Link, navigate } from "../router";
import { ago, dateTime, Empty, ErrorBox, PageTitle, Pill, useLoad } from "../ui";

function Progress({ campaign }: { campaign: EmailCampaign }) {
  const { sent, queued, failed, skipped } = campaign.counts;
  return (
    <div className="progress-cell">
      <div className="bar" aria-hidden>
        <span style={{ width: `${campaign.recipientCount ? (sent / campaign.recipientCount) * 100 : 0}%` }} />
      </div>
      <span className="small">
        {sent} of {campaign.recipientCount} sent
        {queued ? <span className="muted"> · {queued} waiting</span> : null}
        {failed ? <span className="warn"> · {failed} failed</span> : null}
        {skipped ? <span className="muted"> · {skipped} skipped</span> : null}
      </span>
    </div>
  );
}

/** Refreshes every few seconds while emails are still going out. */
function useRefreshWhile(active: boolean, reload: () => void) {
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(reload, 5000);
    return () => clearInterval(timer);
  }, [active, reload]);
}

export function Emails() {
  const { data, error, loading, reload } = useLoad(() => api<EmailCampaignsResponse>("/emails"), "emails");
  useRefreshWhile(Boolean(data?.campaigns.some((c) => c.counts.queued > 0)), reload);

  return (
    <>
      <PageTitle
        title="Emails"
        subtitle="Announcements to many members, and emails sent to one member from their page."
        right={
          <Link to="/emails/new" className="button primary">
            New announcement
          </Link>
        }
      />
      <ErrorBox message={error} />
      {data ? (
        <p className="muted small table-note">
          {data.sentToday} of {data.dailyLimit} announcement emails sent in the last 24 hours. The rest of the email account’s
          daily allowance is kept for sign-in codes; anything over the limit waits until the next day.
        </p>
      ) : null}
      {loading && !data ? <Empty>Loading…</Empty> : null}
      {data && !data.campaigns.length ? <Empty>No emails sent yet.</Empty> : null}
      {data?.campaigns.length ? (
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th>Sent</th>
                <th>Subject</th>
                <th>To</th>
                <th>By</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {data.campaigns.map((c) => (
                <tr key={c.id} className="clickable" onClick={() => navigate(`/emails/${c.id}`)}>
                  <td className="nowrap" title={dateTime(c.createdAt)}>
                    {ago(c.createdAt)}
                  </td>
                  <td>
                    <Link to={`/emails/${c.id}`}>{c.subject}</Link>
                  </td>
                  <td>
                    {c.kind === "single" ? (
                      <span>{c.recipient?.firstName ?? "One member"}</span>
                    ) : (
                      <span className="small">{c.audience ? describeAudience(c.audience) : "Members"}</span>
                    )}
                  </td>
                  <td className="muted">{c.sentBy}</td>
                  <td>
                    <Progress campaign={c} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}

export function EmailPage({ id }: { id: string }) {
  const { data, error, loading, reload } = useLoad(() => api<EmailCampaignDetail>(`/emails/${encodeURIComponent(id)}`), id);
  useRefreshWhile(Boolean(data && data.counts.queued > 0), reload);
  // The list endpoint is what nudges queued emails along locally, so keep calling it while waiting.
  useEffect(() => {
    if (!data?.counts.queued) return;
    const timer = setInterval(() => void api("/emails").catch(() => undefined), 5000);
    return () => clearInterval(timer);
  }, [data?.counts.queued]);

  if (loading && !data) return <Empty>Loading…</Empty>;
  if (!data) return <ErrorBox message={error ?? "Email not found."} />;

  return (
    <>
      <p className="crumbs">
        <Link to="/emails">Emails</Link> / {data.subject}
      </p>
      <PageTitle title={data.subject} subtitle={`Sent by ${data.sentBy}, ${dateTime(data.createdAt)}`} />
      <ErrorBox message={error} />
      <div className="member-layout">
        <section className="card section stack">
          <h2>Message</h2>
          <p className="small muted">
            To:{" "}
            {data.kind === "single"
              ? data.recipient?.id
                ? <Link to={`/members/${data.recipient.id}`}>{data.recipient.firstName ?? "member"}</Link>
                : "one member"
              : data.audience
                ? describeAudience(data.audience)
                : "members"}
          </p>
          <div className="email-body">{data.body}</div>
        </section>
        <section className="card section stack">
          <h2>Progress</h2>
          <Progress campaign={data} />
          {data.counts.queued ? <p className="small muted">Going out a few at a time. This page updates by itself.</p> : null}
          {data.counts.skipped ? (
            <p className="small muted">Skipped: members who unsubscribed, were suspended or deleted their account after it was queued.</p>
          ) : null}
        </section>
      </div>

      <h2>Recipients{data.recipients.length === 500 ? " (first 500)" : ""}</h2>
      <div className="card table-card">
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Email</th>
              <th>Status</th>
              <th>Sent</th>
            </tr>
          </thead>
          <tbody>
            {data.recipients.map((r, i) => (
              <tr key={`${r.email}-${i}`}>
                <td>{r.userId ? <Link to={`/members/${r.userId}`}>{r.firstName ?? "No name yet"}</Link> : (r.firstName ?? "Deleted account")}</td>
                <td className="muted">{r.email}</td>
                <td>
                  <Pill>{r.status === "sending" ? "queued" : r.status}</Pill>
                  {r.error ? <div className="small warn">{r.error}</div> : null}
                </td>
                <td className="muted nowrap">{r.sentAt ? dateTime(r.sentAt) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
