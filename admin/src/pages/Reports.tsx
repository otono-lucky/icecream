import { REPORT_REASON_LABELS, type Report, type ReportsResponse, type ReportStatus, type ResolveReportBody } from "@contracts";
import { useState } from "react";

import { api, errorMessage } from "../api";
import { Link, navigate, useQuery } from "../router";
import { ago, dateTime, Empty, ErrorBox, MemberLink, PageTitle, Pill, Tabs, useLoad } from "../ui";

function ReportCard({ report, onDone }: { report: Report; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function resolve(outcome: ResolveReportBody["outcome"]) {
    setBusy(true);
    setError(undefined);
    try {
      await api(`/reports/${report.id}/resolve`, { json: { outcome, note: note.trim() || undefined } });
      onDone();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <article className="card report">
      <div className="row spread">
        <strong>{REPORT_REASON_LABELS[report.reason]}</strong>
        <Pill>{report.status}</Pill>
      </div>
      {report.details ? <blockquote>“{report.details}”</blockquote> : <p className="muted small">No details given.</p>}

      <div className="report-people">
        <div>
          <span className="caption">Reported member</span>
          <MemberLink member={report.reported} showStatus />
          {report.reported.openReports > 1 ? (
            <p className="small warn">{report.reported.openReports} open reports against this member</p>
          ) : null}
        </div>
        <div>
          <span className="caption">Reported by</span>
          <MemberLink member={report.reporter} />
          <p className="muted small">
            {ago(report.createdAt)} ({dateTime(report.createdAt)})
          </p>
        </div>
      </div>

      {report.status === "open" ? (
        <div className="stack">
          <textarea
            rows={2}
            placeholder="Note for the team: what you checked or did (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
          />
          <ErrorBox message={error} />
          <div className="row">
            <button type="button" className="button primary" disabled={busy} onClick={() => void resolve("actioned")}>
              Dealt with
            </button>
            <button type="button" className="button secondary" disabled={busy} onClick={() => void resolve("dismissed")}>
              Dismiss
            </button>
            <Link to={`/members/${report.reported.id}`} className="button text">
              Open member to suspend…
            </Link>
          </div>
          <p className="muted small">
            “Dealt with” means you took action (warned or suspended them). “Dismiss” means nothing was wrong. The reporter isn’t told
            either way.
          </p>
        </div>
      ) : (
        <p className="small">
          {report.status === "actioned" ? "Dealt with" : "Dismissed"} by {report.resolvedBy ?? "someone"}
          {report.resolvedAt ? ` ${ago(report.resolvedAt)}` : ""}
          {report.resolutionNote ? (
            <>
              <br />
              <span className="muted">Note: {report.resolutionNote}</span>
            </>
          ) : null}
        </p>
      )}
    </article>
  );
}

export function Reports() {
  const query = useQuery();
  const status = (["open", "actioned", "dismissed"] as const).find((s) => s === query.get("status")) ?? "open";
  const { data, error, loading, reload } = useLoad(() => api<ReportsResponse>(`/reports?status=${status}`), status);

  return (
    <>
      <PageTitle title="Reports" subtitle="Members reported by other members. Oldest first, so nobody waits too long." />
      <Tabs<ReportStatus>
        value={status}
        options={[
          { value: "open", label: "Open" },
          { value: "actioned", label: "Dealt with" },
          { value: "dismissed", label: "Dismissed" },
        ]}
        onChange={(value) => navigate(`/reports?status=${value}`, { replace: true })}
      />
      <ErrorBox message={error} />
      {data && !data.reports.length ? <Empty>{status === "open" ? "No open reports." : "None yet."}</Empty> : null}
      {loading && !data ? <Empty>Loading…</Empty> : null}
      <div className="list">
        {data?.reports.map((report) => (
          <ReportCard key={report.id} report={report} onDone={reload} />
        ))}
      </div>
    </>
  );
}
