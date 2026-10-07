import { MAX_EMAIL_BODY, MAX_EMAIL_SUBJECT, type AudiencePreview, type EmailAudience } from "@contracts";
import { useEffect, useState } from "react";

import { api, errorMessage, getSession } from "../api";
import { Link, navigate } from "../router";
import { ErrorBox, PageTitle } from "../ui";
import { describeAudience } from "../labels";

const EXAMPLE_NAME = "Chioma";

/** Subject and message fields, shared by announcements and emails to one member. */
export function DraftFields({
  subject,
  body,
  onSubject,
  onBody,
}: {
  subject: string;
  body: string;
  onSubject: (value: string) => void;
  onBody: (value: string) => void;
}) {
  return (
    <>
      <label className="field">
        <span>Subject</span>
        <input value={subject} maxLength={MAX_EMAIL_SUBJECT} onChange={(e) => onSubject(e.target.value)} />
      </label>
      <label className="field">
        <span>Message</span>
        <textarea rows={10} value={body} maxLength={MAX_EMAIL_BODY} onChange={(e) => onBody(e.target.value)} />
        <span className="muted small hint">
          Plain text. Leave a blank line between paragraphs. Write <code>{"{name}"}</code> for the member’s first name. “The icecream
          team” is added at the end.
        </span>
      </label>
    </>
  );
}

/** How the email will read for one member. */
export function EmailPreview({ subject, body, name, bulk }: { subject: string; body: string; name: string; bulk?: boolean }) {
  const fill = (text: string) => text.replace(/\{name\}/g, name);
  return (
    <div className="email-preview">
      <div className="caption">Preview, as {name} would see it</div>
      <div className="email-preview-card">
        <strong>{fill(subject) || "Subject"}</strong>
        <div className="email-body">{fill(body) || "Your message…"}</div>
        <p className="muted">The icecream team</p>
      </div>
      {bulk ? <p className="muted small">With an “Unsubscribe from announcements” link at the bottom.</p> : null}
    </div>
  );
}

export function Compose() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<EmailAudience>({ status: "active" });
  const [preview, setPreview] = useState<AudiencePreview>();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<"test" | "send">();
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const ready = subject.trim() && body.trim();

  // How many members the filters reach, checked shortly after they stop changing.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      api<AudiencePreview>("/emails/preview", { json: audience }).then(
        (result) => !cancelled && setPreview(result),
        (e: unknown) => !cancelled && setError(errorMessage(e)),
      );
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [audience]);

  const set = (patch: Partial<EmailAudience>) => {
    setConfirming(false);
    setAudience((current) => ({ ...current, ...patch }));
  };

  async function sendTest() {
    setBusy("test");
    setError(undefined);
    setNotice(undefined);
    try {
      const { sentTo } = await api<{ sentTo: string }>("/emails/test", { json: { subject, body } });
      setNotice(`Test sent to ${sentTo}. Check your inbox.`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(undefined);
    }
  }

  async function send() {
    setBusy("send");
    setError(undefined);
    try {
      const { id } = await api<{ id: string }>("/emails/bulk", { json: { subject, body, audience } });
      navigate(`/emails/${id}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(undefined);
    }
  }

  const count = preview?.count ?? 0;
  const firstName = getSession()?.admin.name.split(" ")[0];

  return (
    <>
      <p className="crumbs">
        <Link to="/emails">Emails</Link> / New announcement
      </p>
      <PageTitle title="New announcement" subtitle="An email to many members at once." />
      <div className="member-layout">
        <section className="card section stack">
          <h2>Who gets it</h2>
          <div className="filters">
            <select aria-label="Members" value={audience.status} onChange={(e) => set({ status: e.target.value as EmailAudience["status"] })}>
              <option value="active">Active members</option>
              <option value="onboarding">Still signing up</option>
              <option value="everyone">Active and signing up</option>
            </select>
            <select aria-label="Gender" value={audience.gender ?? ""} onChange={(e) => set({ gender: (e.target.value || undefined) as EmailAudience["gender"] })}>
              <option value="">Women and men</option>
              <option value="woman">Women</option>
              <option value="man">Men</option>
            </select>
            <select aria-label="Plan" value={audience.plan ?? ""} onChange={(e) => set({ plan: (e.target.value || undefined) as EmailAudience["plan"] })}>
              <option value="">With or without a plan</option>
              <option value="with">With a messaging plan</option>
              <option value="without">Without a plan</option>
            </select>
            <input aria-label="City" placeholder="Any city" value={audience.city ?? ""} onChange={(e) => set({ city: e.target.value || undefined })} />
          </div>
          <p className="audience-count">
            {preview ? (
              <>
                <strong>{count === 1 ? "1 member" : `${count} members`}</strong> will get this
                {preview.unsubscribed ? <span className="muted"> ({preview.unsubscribed} more unsubscribed)</span> : null}.
              </>
            ) : (
              <span className="muted">Counting…</span>
            )}
          </p>
          <p className="muted small">Suspended members and anyone under 35 never get announcements.</p>

          <h2>Message</h2>
          <DraftFields subject={subject} body={body} onSubject={setSubject} onBody={setBody} />
          <ErrorBox message={error} />
          {notice ? <div className="notice-box">{notice}</div> : null}

          {confirming ? (
            <div className="card stack confirm">
              <strong>
                Send “{subject}” to {count === 1 ? "1 member" : `${count} members`}?
              </strong>
              <p className="small muted">
                {describeAudience(audience)}. It goes out about 20 a minute, up to the daily limit, and can’t be stopped once sent.
              </p>
              <div className="row">
                <button type="button" className="button primary" disabled={busy === "send"} onClick={() => void send()}>
                  {busy === "send" ? "Sending…" : "Yes, send it"}
                </button>
                <button type="button" className="button text" onClick={() => setConfirming(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="row">
              <button type="button" className="button primary" disabled={!ready || !count || Boolean(busy)} onClick={() => setConfirming(true)}>
                Send to {count === 1 ? "1 member" : `${count} members`}…
              </button>
              <button type="button" className="button secondary" disabled={!ready || Boolean(busy)} onClick={() => void sendTest()}>
                {busy === "test" ? "Sending…" : "Send me a test"}
              </button>
            </div>
          )}
        </section>
        <section className="card section">
          <EmailPreview subject={subject} body={body} name={EXAMPLE_NAME} bulk />
          {firstName ? <p className="muted small">The test email uses your name, {firstName}.</p> : null}
        </section>
      </div>
    </>
  );
}
