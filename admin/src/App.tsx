import type { Overview as OverviewData } from "@contracts";
import { useSyncExternalStore } from "react";

import { api, getSession, setSession, subscribeSession } from "./api";
import { Checks } from "./pages/Checks";
import { Compose } from "./pages/Compose";
import { EmailPage, Emails } from "./pages/Emails";
import { MemberPage } from "./pages/MemberPage";
import { Members } from "./pages/Members";
import { Overview } from "./pages/Overview";
import { Payments } from "./pages/Payments";
import { Reports } from "./pages/Reports";
import { SignIn } from "./pages/SignIn";
import { Link, usePath } from "./router";
import { useLoad } from "./ui";

const NAV = [
  { to: "/", label: "Overview" },
  { to: "/checks", label: "Checks", count: "pendingChecks" },
  { to: "/reports", label: "Reports", count: "openReports" },
  { to: "/members", label: "Members" },
  { to: "/emails", label: "Emails" },
  { to: "/payments", label: "Payments" },
] as const;

function Page({ path }: { path: string }) {
  const route = path.split("?")[0];
  const member = /^\/members\/([^/]+)$/.exec(route);
  if (member) return <MemberPage id={decodeURIComponent(member[1])} />;
  if (route === "/emails/new") return <Compose />;
  const email = /^\/emails\/([^/]+)$/.exec(route);
  if (email) return <EmailPage id={decodeURIComponent(email[1])} />;
  switch (route) {
    case "/":
      return <Overview />;
    case "/checks":
      return <Checks />;
    case "/reports":
      return <Reports />;
    case "/members":
      return <Members />;
    case "/payments":
      return <Payments />;
    case "/emails":
      return <Emails />;
    default:
      return (
        <div className="empty-state">
          This page doesn’t exist. <Link to="/">Go to the overview</Link>
        </div>
      );
  }
}

export function App() {
  const session = useSyncExternalStore(subscribeSession, getSession);
  const path = usePath();
  if (!session) return <SignIn />;
  return <Shell path={path} name={session.admin.name} />;
}

function Shell({ path, name }: { path: string; name: string }) {
  // Counts beside Checks and Reports, refreshed whenever the page changes.
  const overview = useLoad(() => api<OverviewData>("/overview"), path);
  const route = path.split("?")[0];

  async function signOut() {
    await api("/auth/sign-out", { method: "POST" }).catch(() => undefined);
    setSession(null);
  }

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="wordmark">
          icecream<span className="dot" />
          <span className="wordmark-tag">Admin</span>
        </div>
        <ul>
          {NAV.map((item) => {
            const active = item.to === "/" ? route === "/" : route.startsWith(item.to);
            const count = "count" in item ? overview.data?.[item.count] : undefined;
            return (
              <li key={item.to}>
                <Link to={item.to} className={active ? "nav-item active" : "nav-item"}>
                  {item.label}
                  {count ? <span className="badge">{count}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="sidebar-footer">
          <span className="muted">Signed in as</span>
          <strong>{name}</strong>
          <button type="button" className="button text small" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </nav>
      <main className="content">
        <Page path={path} />
      </main>
    </div>
  );
}
