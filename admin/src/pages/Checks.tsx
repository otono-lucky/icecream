import type { Check, CheckDecisionBody, ChecksResponse, CheckStatus } from "@contracts";
import { useState, type FormEvent } from "react";

import { api, errorMessage } from "../api";
import { checkLabel } from "../labels";
import { Link, navigate, useQuery } from "../router";
import { ago, dateTime, Empty, ErrorBox, PageTitle, Photo, Pill, Tabs, useLoad } from "../ui";

// Shown to the member in the app, so written to them. Pick one or write your own.
const REASONS: Record<Check["kind"], string[]> = {
  liveness: [
    "Your selfie doesn’t match your profile photos. Please take it again in good light.",
    "Your face isn’t clearly visible in the selfie. Please take it again without glasses or a face covering.",
    "Your profile photos don’t meet our guidelines. Please use clear, recent photos of just you.",
  ],
  government_id: [
    "The photo of your ID is unclear. Please take it again so every detail can be read.",
    "The name or photo on your ID doesn’t match your profile.",
    "This ID has expired. Please use a valid one.",
  ],
};

// ---- Filters (kept in the address, so a filtered view can be refreshed or shared with the team) ----

type Filters = { status: CheckStatus; kind: string; gender: string; q: string; sort: string };

function readFilters(query: URLSearchParams): Filters {
  return {
    status: (["pending", "passed", "failed"] as const).find((s) => s === query.get("status")) ?? "pending",
    kind: query.get("kind") ?? "",
    gender: query.get("gender") ?? "",
    q: query.get("q") ?? "",
    sort: query.get("sort") ?? "",
  };
}

function toQuery(filters: Filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  return params.toString();
}

function FilterBar({ filters }: { filters: Filters }) {
  const [search, setSearch] = useState(filters.q);
  const set = (patch: Partial<Filters>) => navigate(`/checks?${toQuery({ ...filters, ...patch })}`, { replace: true });
  const filtered = filters.kind || filters.gender || filters.q || filters.sort;

  function submit(event: FormEvent) {
    event.preventDefault();
    set({ q: search.trim() });
  }

  return (
    <form className="filters" onSubmit={submit}>
      <input
        type="search"
        aria-label="Search"
        placeholder="Name, email or city"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onBlur={() => search.trim() !== filters.q && set({ q: search.trim() })}
      />
      <select aria-label="Type" value={filters.kind} onChange={(e) => set({ kind: e.target.value })}>
        <option value="">All types</option>
        <option value="liveness">Selfie checks</option>
        <option value="government_id">ID checks</option>
      </select>
      <select aria-label="Gender" value={filters.gender} onChange={(e) => set({ gender: e.target.value })}>
        <option value="">Women and men</option>
        <option value="woman">Women</option>
        <option value="man">Men</option>
      </select>
      <select aria-label="Order" value={filters.sort} onChange={(e) => set({ sort: e.target.value })}>
        <option value="">{filters.status === "pending" ? "Oldest first" : "Newest first"}</option>
        <option value={filters.status === "pending" ? "newest" : "oldest"}>
          {filters.status === "pending" ? "Newest first" : "Oldest first"}
        </option>
      </select>
      <button type="submit" className="button secondary">
        Search
      </button>
      {filtered ? (
        <button
          type="button"
          className="button text"
          onClick={() => {
            setSearch("");
            navigate(`/checks?status=${filters.status}`, { replace: true });
          }}
        >
          Clear filters
        </button>
      ) : null}
    </form>
  );
}

// ---- Reject dialog ----

function RejectDialog({ check, onClose, onDone }: { check: Check; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function reject() {
    setBusy(true);
    setError(undefined);
    try {
      await api(`/checks/${check.id}/decision`, { json: { decision: "fail", reason } satisfies CheckDecisionBody });
      onDone();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="card modal stack" role="dialog" aria-modal="true" aria-label="Reject check" onClick={(e) => e.stopPropagation()}>
        <h2>
          Reject {check.member.firstName ?? "this member"}’s {check.kind === "liveness" ? "selfie" : "ID"} check
        </h2>
        <p className="small muted">They see this reason in the app, so write it to them.</p>
        {REASONS[check.kind].map((text) => (
          <label key={text} className="radio">
            <input type="radio" name="reason" checked={reason === text} onChange={() => setReason(text)} />
            {text}
          </label>
        ))}
        <textarea rows={3} placeholder="Or write your own reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        <ErrorBox message={error} />
        <div className="row">
          <button type="button" className="button danger" disabled={busy || !reason.trim()} onClick={() => void reject()}>
            {busy ? "Saving…" : "Reject check"}
          </button>
          <button type="button" className="button text" disabled={busy} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Table ----

function CheckRow({ check, onApprove, onReject, busy }: { check: Check; onApprove: () => void; onReject: () => void; busy: boolean }) {
  const { member } = check;
  const shown = member.photoKeys.slice(0, 3);
  return (
    <tr>
      <td>
        <Photo objectKey={check.submissionKey} size={64} alt={`${checkLabel(check)} for ${member.firstName ?? "member"}`} />
      </td>
      <td>
        <div className="thumbs">
          {shown.map((key, i) => (
            <Photo key={key} objectKey={key} size={48} alt={`Profile photo ${i + 1}`} />
          ))}
          {member.photoKeys.length > shown.length ? <span className="muted small">+{member.photoKeys.length - shown.length}</span> : null}
        </div>
      </td>
      <td>
        <Link to={`/members/${member.id}`}>
          <strong>{member.firstName ?? "No name yet"}</strong>
        </Link>
        <div className="small">{[member.age, member.gender, member.city].filter(Boolean).join(", ")}</div>
        {member.email ? <div className="small muted ellipsis">{member.email}</div> : null}
      </td>
      <td>{checkLabel(check)}</td>
      <td title={dateTime(check.submittedAt)}>
        <span className="nowrap">{ago(check.submittedAt)}</span>
      </td>
      {check.status === "pending" ? (
        <td>
          <div className="row nowrap-row">
            <button type="button" className="button primary small-button" disabled={busy} onClick={onApprove}>
              {busy ? "Saving…" : "Approve"}
            </button>
            <button type="button" className="button secondary small-button" disabled={busy} onClick={onReject}>
              Reject…
            </button>
          </div>
        </td>
      ) : (
        <td>
          <Pill>{check.status}</Pill>
          <div className="small muted">
            by {check.reviewedBy ?? "someone"}
            {check.reviewedAt ? `, ${ago(check.reviewedAt)}` : ""}
          </div>
          {check.failureReason ? <div className="small reason">{check.failureReason}</div> : null}
        </td>
      )}
    </tr>
  );
}

export function Checks() {
  const filters = readFilters(useQuery());
  const query = toQuery(filters);
  const { data, error, loading, reload } = useLoad(() => api<ChecksResponse>(`/checks?${query}`), query);
  const [rejecting, setRejecting] = useState<Check>();
  const [approving, setApproving] = useState<string>();
  const [actionError, setActionError] = useState<string>();

  async function approve(check: Check) {
    setApproving(check.id);
    setActionError(undefined);
    try {
      await api(`/checks/${check.id}/decision`, { json: { decision: "pass" } satisfies CheckDecisionBody });
      reload();
    } catch (e) {
      setActionError(`${check.member.firstName ?? "That member"}: ${errorMessage(e)}`);
    } finally {
      setApproving(undefined);
    }
  }

  const pending = filters.status === "pending";
  const count = data?.checks.length ?? 0;

  return (
    <>
      <PageTitle
        title="Checks"
        subtitle="Compare each selfie or ID with the member’s profile photos (click any photo to enlarge it). Approving a selfie lets the member start using icecream; approving an ID gives them the “ID verified” badge."
      />
      <Tabs<CheckStatus>
        value={filters.status}
        options={[
          { value: "pending", label: "Waiting" },
          { value: "passed", label: "Approved" },
          { value: "failed", label: "Rejected" },
        ]}
        // Changing tab keeps the other filters but resets the order, which defaults differently per tab.
        onChange={(status) => navigate(`/checks?${toQuery({ ...filters, status, sort: "" })}`, { replace: true })}
      />
      <FilterBar key={filters.q} filters={filters} />
      <ErrorBox message={error ?? actionError} />
      {loading && !data ? <Empty>Loading…</Empty> : null}
      {data && !count ? (
        <Empty>
          {filters.kind || filters.gender || filters.q ? "No checks match these filters." : pending ? "Nothing waiting. Well done." : "None yet."}
        </Empty>
      ) : null}
      {count ? (
        <>
          <p className="muted small table-note">
            {count === 100 ? "Showing the first 100. Use the filters to narrow it down." : `${count} ${count === 1 ? "check" : "checks"}`}
          </p>
          <div className="card table-card">
            <table className="checks-table">
              <thead>
                <tr>
                  <th>{filters.kind === "government_id" ? "ID" : filters.kind === "liveness" ? "Selfie" : "Selfie / ID"}</th>
                  <th>Profile photos</th>
                  <th>Member</th>
                  <th>Type</th>
                  <th>Sent</th>
                  <th>{pending ? "Decision" : "Outcome"}</th>
                </tr>
              </thead>
              <tbody>
                {data!.checks.map((check) => (
                  <CheckRow
                    key={check.id}
                    check={check}
                    busy={approving === check.id}
                    onApprove={() => void approve(check)}
                    onReject={() => setRejecting(check)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      {rejecting ? (
        <RejectDialog
          check={rejecting}
          onClose={() => setRejecting(undefined)}
          onDone={() => {
            setRejecting(undefined);
            reload();
          }}
        />
      ) : null}
    </>
  );
}
