import { PLAN_ORDER, PLANS, type PaymentsResponse } from "@contracts";

import { api } from "../api";
import { Link, navigate, useQuery } from "../router";
import { dateTime, Empty, ErrorBox, naira, PageTitle, Pill, Tabs, useLoad } from "../ui";

type Filter = "all" | "paid" | "pending" | "failed";

export function Payments() {
  const query = useQuery();
  const filter = (["paid", "pending", "failed"] as const).find((s) => s === query.get("status")) ?? "all";
  const { data, error, loading } = useLoad(
    () => api<PaymentsResponse>(`/payments${filter === "all" ? "" : `?status=${filter}`}`),
    filter,
  );

  return (
    <>
      <PageTitle title="Payments" subtitle="Messaging plans. Amounts in naira; totals count paid payments only." />
      <ErrorBox message={error} />
      {data ? (
        <div className="stats">
          <div className="card stat">
            <span className="stat-value">{naira(data.totals.paidThisMonthKobo)}</span>
            <span className="stat-label">Paid this month</span>
          </div>
          <div className="card stat">
            <span className="stat-value">{naira(data.totals.paidAllTimeKobo)}</span>
            <span className="stat-label">Paid all time ({data.totals.paidCount} payments)</span>
          </div>
          {PLAN_ORDER.map((plan) => (
            <div key={plan} className="card stat">
              <span className="stat-value">{data.activeSubscriptions[plan]}</span>
              <span className="stat-label">Active {PLANS[plan].label.toLowerCase()} plans</span>
            </div>
          ))}
        </div>
      ) : null}

      <Tabs<Filter>
        value={filter}
        options={[
          { value: "all", label: "All" },
          { value: "paid", label: "Paid" },
          { value: "pending", label: "Started, not paid" },
          { value: "failed", label: "Failed" },
        ]}
        onChange={(value) => navigate(value === "all" ? "/payments" : `/payments?status=${value}`, { replace: true })}
      />
      {loading && !data ? <Empty>Loading…</Empty> : null}
      {data && !data.payments.length ? <Empty>No payments.</Empty> : null}
      {data?.payments.length ? (
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Member</th>
                <th>Plan</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((p) => (
                <tr key={p.reference}>
                  <td>{dateTime(p.createdAt)}</td>
                  <td>
                    <Link to={`/members/${p.member.id}`}>{p.member.firstName ?? "No name yet"}</Link>
                  </td>
                  <td>{PLANS[p.plan].label}</td>
                  <td>{naira(p.amountKobo)}</td>
                  <td>
                    <Pill>{p.status}</Pill>
                    {p.provider === "fake" ? <span className="muted small"> test</span> : null}
                  </td>
                  <td className="muted small">
                    <code>{p.reference}</code>
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
