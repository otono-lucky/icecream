import type { Overview as OverviewData } from "@contracts";

import { api } from "../api";
import { Link } from "../router";
import { ErrorBox, naira, PageTitle, useLoad } from "../ui";

function Stat({ label, value, to, urgent }: { label: string; value: string | number; to?: string; urgent?: boolean }) {
  const body = (
    <>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </>
  );
  return to ? (
    <Link to={to} className={`card stat ${urgent ? "urgent" : ""}`}>
      {body}
    </Link>
  ) : (
    <div className="card stat">{body}</div>
  );
}

export function Overview() {
  const { data, error } = useLoad(() => api<OverviewData>("/overview"), "overview");

  return (
    <>
      <PageTitle title="Overview" subtitle="What needs attention, and how icecream is doing." />
      <ErrorBox message={error} />
      {data ? (
        <>
          <h2>Needs attention</h2>
          <div className="stats">
            <Stat label="Checks waiting" value={data.pendingChecks} to="/checks" urgent={data.pendingChecks > 0} />
            <Stat label="Open reports" value={data.openReports} to="/reports" urgent={data.openReports > 0} />
          </div>
          <h2>Members</h2>
          <div className="stats">
            <Stat label="Active" value={data.members.active} to="/members?status=active" />
            <Stat label="Signing up" value={data.members.onboarding} to="/members?status=onboarding" />
            <Stat label="Suspended" value={data.members.suspended} to="/members?status=suspended" />
            <Stat label="Under 35 (not eligible)" value={data.members.ineligible} to="/members?status=ineligible" />
          </div>
          <h2>Money</h2>
          <div className="stats">
            <Stat label="Paid this month" value={naira(data.revenueThisMonthKobo)} to="/payments" />
            <Stat label="Active plans" value={data.activeSubscriptions} to="/payments" />
          </div>
        </>
      ) : null}
    </>
  );
}
