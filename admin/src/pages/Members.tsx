import type { MembersResponse, UserStatus } from "@contracts";
import { useState, type FormEvent } from "react";

import { api } from "../api";
import { Link, navigate, useQuery } from "../router";
import { date, Empty, ErrorBox, PageTitle, Photo, Pill, useLoad } from "../ui";

const STATUSES: { value: UserStatus | ""; label: string }[] = [
  { value: "", label: "Everyone" },
  { value: "active", label: "Active" },
  { value: "onboarding", label: "Signing up" },
  { value: "suspended", label: "Suspended" },
  { value: "ineligible", label: "Under 35" },
];

export function Members() {
  const query = useQuery();
  const q = query.get("q") ?? "";
  const status = query.get("status") ?? "";
  const [search, setSearch] = useState(q);
  const params = new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}) }).toString();
  const { data, error, loading } = useLoad(() => api<MembersResponse>(`/members${params ? `?${params}` : ""}`), params);

  const go = (next: { q?: string; status?: string }) => {
    const p = new URLSearchParams({ ...(next.q ? { q: next.q } : {}), ...(next.status ? { status: next.status } : {}) }).toString();
    navigate(`/members${p ? `?${p}` : ""}`, { replace: true });
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    go({ q: search.trim(), status });
  }

  return (
    <>
      <PageTitle title="Members" subtitle="Search by first name, email address or member ID." />
      <form className="row search" onSubmit={submit}>
        <input type="search" placeholder="e.g. Chioma, ada@example.com" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={status} onChange={(e) => go({ q, status: e.target.value })} aria-label="Status">
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button type="submit" className="button primary">
          Search
        </button>
      </form>
      <ErrorBox message={error} />
      {loading && !data ? <Empty>Loading…</Empty> : null}
      {data && !data.members.length ? <Empty>No members match.</Empty> : null}
      {data?.members.length ? (
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th />
                <th>Name</th>
                <th>Age</th>
                <th>City</th>
                <th>Email</th>
                <th>Status</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.id} onClick={() => navigate(`/members/${m.id}`)} className="clickable">
                  <td>
                    <Photo objectKey={m.photoKey} size={36} zoom={false} />
                  </td>
                  <td>
                    <Link to={`/members/${m.id}`}>{m.firstName ?? "No name yet"}</Link>
                    {m.gender ? <span className="muted small"> · {m.gender}</span> : null}
                  </td>
                  <td>{m.age ?? "—"}</td>
                  <td>{m.city ?? "—"}</td>
                  <td className="muted">{m.email ?? "—"}</td>
                  <td>
                    <Pill>{m.status}</Pill>
                  </td>
                  <td className="muted">{date(m.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.members.length === 50 ? <p className="muted small pad">Showing the first 50. Search to narrow it down.</p> : null}
        </div>
      ) : null}
    </>
  );
}
