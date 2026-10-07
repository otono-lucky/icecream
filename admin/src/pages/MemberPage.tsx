import { LABELS, PLANS, REPORT_REASON_LABELS, type AdminActionKind, type MemberDetail, type ProfileAnswers } from "@contracts";
import { useState, type ReactNode } from "react";

import { api, errorMessage } from "../api";
import { Link } from "../router";
import { ago, date, dateTime, describe, Empty, ErrorBox, MemberLink, naira, PageTitle, Photo, Pill, useLoad } from "../ui";
import { checkLabel } from "../labels";
import { DraftFields, EmailPreview } from "./Compose";

const ACTIONS: Record<AdminActionKind, string> = {
  verification_passed: "Approved a check",
  verification_failed: "Rejected a check",
  report_actioned: "Dealt with a report",
  report_dismissed: "Dismissed a report",
  member_suspended: "Suspended",
  member_restored: "Restored",
  email_sent: "Sent an email",
};

/** Write and send one email to this member, about their account. */
function EmailMember({ detail, onDone }: { detail: MemberDetail; onDone: () => void }) {
  const { member } = detail;
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState<string>();
  if (!member.email) return null;

  async function send() {
    setBusy(true);
    setError(undefined);
    try {
      await api(`/members/${member.id}/email`, { json: { subject, body } });
      setSent(subject);
      setOpen(false);
      setSubject("");
      setBody("");
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {sent ? <div className="notice-box">Email “{sent}” sent to {member.email}.</div> : null}
      <button type="button" className="button secondary" onClick={() => setOpen(true)}>
        Send email…
      </button>
      {open ? (
        <div className="modal-backdrop" role="presentation" onClick={() => !busy && setOpen(false)}>
          <div className="card modal wide stack" role="dialog" aria-modal="true" aria-label="Send email" onClick={(e) => e.stopPropagation()}>
            <h2>Email {member.firstName ?? "this member"}</h2>
            <p className="small muted">To {member.email}. About their own account, so it reaches them even if they unsubscribed from announcements.</p>
            <DraftFields subject={subject} body={body} onSubject={setSubject} onBody={setBody} />
            <EmailPreview subject={subject} body={body} name={member.firstName ?? "there"} />
            <ErrorBox message={error} />
            <div className="row">
              <button type="button" className="button primary" disabled={busy || !subject.trim() || !body.trim()} onClick={() => void send()}>
                {busy ? "Sending…" : "Send email"}
              </button>
              <button type="button" className="button text" disabled={busy} onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="facts">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function profileRows(p: ProfileAnswers): [string, ReactNode][] {
  const pick = <K extends string>(labels: Record<K, string>, value: K | null) => (value ? labels[value] : null);
  return [
    ["Marital history", pick(LABELS.maritalStatus, p.maritalStatus)],
    [
      "Children",
      p.hasChildren === null
        ? null
        : p.hasChildren
          ? `${p.childrenCount ?? "?"} · lives with them: ${pick(LABELS.childrenLiveWith, p.childrenLiveWith) ?? "?"}`
          : "None",
    ],
    ["Open to partner with children", pick(LABELS.yesMaybeNo, p.openToPartnerWithChildren)],
    ["Faith", [pick(LABELS.faith, p.faith), pick(LABELS.faithPractice, p.faithPractice)].filter(Boolean).join(" · ") || null],
    ["Partner’s faith", pick(LABELS.partnerFaithImportance, p.partnerFaithImportance)],
    ["Would relocate", pick(LABELS.relocate, p.relocate)],
    ["Work", p.occupation],
    ["Typical week", p.typicalWeek],
    ["Looking for", pick(LABELS.lookingFor, p.lookingFor)],
    ["In their own words", p.ownWords],
  ];
}

/** Suspend (with a reason) or restore, depending on where the member is now. */
function StatusAction({ detail, onDone }: { detail: MemberDetail; onDone: () => void }) {
  const { member } = detail;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const suspended = member.status === "suspended";
  const canSuspend = member.status === "active" || member.status === "onboarding";
  if (!suspended && !canSuspend) return null;

  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      await api(`/members/${member.id}/${suspended ? "restore" : "suspend"}`, {
        json: suspended ? { note: text.trim() || undefined } : { reason: text.trim() },
      });
      setOpen(false);
      setText("");
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className={`button ${suspended ? "primary" : "danger"}`} onClick={() => setOpen(true)}>
        {suspended ? "Restore member…" : "Suspend member…"}
      </button>
    );
  }
  return (
    <div className="card stack confirm">
      <strong>{suspended ? `Restore ${member.firstName ?? "this member"}?` : `Suspend ${member.firstName ?? "this member"}?`}</strong>
      <p className="small muted">
        {suspended
          ? "They can sign in again and will be shown to others again if their selfie check passed."
          : "They’re signed out straight away, can’t sign back in, and disappear from everyone’s introductions and chats. They aren’t told why."}
      </p>
      <textarea
        rows={2}
        maxLength={500}
        placeholder={suspended ? "Why (optional, for the team)" : "Why (required, for the team)"}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <ErrorBox message={error} />
      <div className="row">
        <button type="button" className={`button ${suspended ? "primary" : "danger"}`} disabled={busy || (!suspended && !text.trim())} onClick={() => void submit()}>
          {busy ? "Saving…" : suspended ? "Restore" : "Suspend"}
        </button>
        <button type="button" className="button text" disabled={busy} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function MemberPage({ id }: { id: string }) {
  const { data, error, loading, reload } = useLoad(() => api<MemberDetail>(`/members/${encodeURIComponent(id)}`), id);

  if (loading && !data) return <Empty>Loading…</Empty>;
  if (!data) {
    return (
      <>
        <ErrorBox message={error ?? "Member not found."} />
        <Link to="/members">Back to members</Link>
      </>
    );
  }
  const { member } = data;

  return (
    <>
      <p className="crumbs">
        <Link to="/members">Members</Link> / {member.firstName ?? member.id}
      </p>
      <PageTitle
        title={describe(member)}
        subtitle={`Joined ${date(member.createdAt)}`}
        right={
          <div className="row">
            <Pill>{member.status}</Pill>
          </div>
        }
      />
      <ErrorBox message={error} />
      <div className="member-layout">
        <div className="stack">
          <Section title="Account">
            <Facts
              rows={[
                ["Email", member.email],
                ["Phone (older accounts)", member.phone],
                ["Date of birth", member.dateOfBirth],
                ["City", member.city],
                ["Member ID", <code key="id">{member.id}</code>],
                ["Reports they’ve made", data.reportsMade],
                ["Blocked by", `${data.blockedBy} ${data.blockedBy === 1 ? "member" : "members"}`],
                ["Announcements", member.unsubscribedAt ? `Unsubscribed ${date(member.unsubscribedAt)}` : "Subscribed"],
              ]}
            />
            <div className="row top">
              <StatusAction detail={data} onDone={reload} />
              <EmailMember detail={data} onDone={reload} />
            </div>
          </Section>

          <Section title={`Photos (${data.photoKeys.length})`}>
            {data.photoKeys.length ? (
              <div className="photo-grid">
                {data.photoKeys.map((key, i) => (
                  <Photo key={key} objectKey={key} size={120} alt={`Photo ${i + 1}`} />
                ))}
              </div>
            ) : (
              <p className="muted">No photos.</p>
            )}
          </Section>

          <Section title="Profile">
            {data.profile ? (
              <>
                <p className="small muted">{data.profile.publishedAt ? `Published ${date(data.profile.publishedAt)}` : "Not published yet, so not shown to anyone."}</p>
                <Facts rows={profileRows(data.profile)} />
              </>
            ) : (
              <p className="muted">Hasn’t started their profile.</p>
            )}
          </Section>
        </div>

        <div className="stack">
          <Section title="Checks">
            {data.checks.length ? (
              <ul className="plain-list">
                {data.checks.map((check) => (
                  <li key={check.id} className="row top">
                    <Photo objectKey={check.submissionKey} size={72} alt={checkLabel(check)} />
                    <div>
                      <div className="row">
                        <strong>{checkLabel(check)}</strong>
                        <Pill>{check.status}</Pill>
                      </div>
                      <p className="small muted">
                        Sent {dateTime(check.submittedAt)}
                        {check.reviewedAt ? ` · reviewed by ${check.reviewedBy ?? "someone"} ${ago(check.reviewedAt)}` : ""}
                      </p>
                      {check.failureReason ? <p className="small">Reason given: {check.failureReason}</p> : null}
                      {check.status === "pending" ? (
                        <Link to="/checks" className="small">
                          Review in Checks
                        </Link>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No checks sent yet.</p>
            )}
          </Section>

          <Section title="Plan and payments">
            {data.subscription ? (
              <p>
                <strong>{PLANS[data.subscription.plan].label}</strong> plan, {data.subscription.status === "cancelled" ? "cancelled, ends" : "renews"}{" "}
                {date(data.subscription.currentPeriodEnd)}
              </p>
            ) : (
              <p className="muted">No plan.</p>
            )}
            {data.payments.length ? (
              <table>
                <tbody>
                  {data.payments.map((p) => (
                    <tr key={p.reference}>
                      <td>{date(p.createdAt)}</td>
                      <td>{PLANS[p.plan].label}</td>
                      <td>{naira(p.amountKobo)}</td>
                      <td>
                        <Pill>{p.status}</Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </Section>

          <Section title={`Reports against them (${data.reportsAgainst.length})`}>
            {data.reportsAgainst.length ? (
              <ul className="plain-list">
                {data.reportsAgainst.map((r) => (
                  <li key={r.id} className="stack tight">
                    <div className="row spread">
                      <strong>{REPORT_REASON_LABELS[r.reason]}</strong>
                      <Pill>{r.status}</Pill>
                    </div>
                    {r.details ? <blockquote>“{r.details}”</blockquote> : null}
                    <div className="row small muted">
                      by <MemberLink member={r.reporter} /> {ago(r.createdAt)}
                    </div>
                    {r.resolutionNote ? <p className="small">Note from {r.resolvedBy}: {r.resolutionNote}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">None.</p>
            )}
          </Section>

          <Section title="Team history">
            {data.history.length ? (
              <ul className="plain-list">
                {data.history.map((h, i) => (
                  <li key={i}>
                    <strong>{ACTIONS[h.action]}</strong> by {h.adminName} <span className="muted small">{dateTime(h.createdAt)}</span>
                    {h.note ? <p className="small muted">{h.note}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No team actions yet.</p>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
