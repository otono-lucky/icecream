import type { MemberSummary, UserStatus } from "@contracts";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { errorMessage, loadImage } from "./api";
import { Link } from "./router";

// ---- Data loading ----

type Loaded<T> = { data?: T; error?: string; loading: boolean; reload: () => void };

/** Loads once per `key`, and again on reload(). Keeps showing the last data while reloading. */
export function useLoad<T>(load: () => Promise<T>, key: string): Loaded<T> {
  const [state, setState] = useState<{ key: string; data?: T; error?: string; loading: boolean }>({ key, loading: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    load().then(
      (data) => !cancelled && setState({ key, data, loading: false }),
      (error: unknown) => !cancelled && setState((s) => ({ key, data: s.key === key ? s.data : undefined, error: errorMessage(error), loading: false })),
    );
    return () => {
      cancelled = true;
    };
    // `load` changes every render; `key` and `version` say when to fetch again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const current = state.key === key;
  return { data: current ? state.data : undefined, error: current ? state.error : undefined, loading: !current || state.loading, reload };
}

// ---- Formatting ----

export const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;

export const dateTime = (ms: number) =>
  new Date(ms).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const date = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function ago(ms: number) {
  const minutes = Math.round((Date.now() - ms) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days} d ago` : date(ms);
}

export const describe = (m: Pick<MemberSummary, "firstName" | "age" | "gender" | "city">) =>
  [m.firstName ?? "No name yet", m.age, m.gender, m.city].filter(Boolean).join(", ");

// ---- Pieces ----

/** A member's photo, selfie or ID image. Click to see it full size. */
export function Photo({
  objectKey,
  size = 64,
  wide,
  alt = "",
  zoom = true,
}: {
  objectKey: string | null;
  size?: number;
  wide?: boolean;
  alt?: string;
  /** False inside links, where a click should follow the link instead. */
  zoom?: boolean;
}) {
  const [url, setUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!objectKey) return;
    let cancelled = false;
    loadImage(objectKey).then(
      (loaded) => !cancelled && setUrl(loaded),
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [objectKey]);

  const style = wide ? { width: "100%", aspectRatio: "3 / 4" } : { width: size, height: size };
  if (!objectKey || failed) return <div className="photo empty" style={style} aria-label={failed ? "Image didn't load" : "No photo"} />;
  if (!zoom) return <span className="photo" style={style}>{url ? <img src={url} alt={alt} /> : null}</span>;
  return (
    <>
      <button type="button" className="photo" style={style} onClick={() => url && setOpen(true)} aria-label={alt || "View full size"}>
        {url ? <img src={url} alt={alt} /> : null}
      </button>
      {open ? (
        <div className="lightbox" role="dialog" onClick={() => setOpen(false)}>
          <img src={url} alt={alt} />
          <span>Click anywhere to close</span>
        </div>
      ) : null}
    </>
  );
}

const STATUS_TONE: Record<string, string> = {
  active: "green",
  passed: "green",
  paid: "green",
  onboarding: "amber",
  pending: "amber",
  open: "amber",
  suspended: "red",
  failed: "red",
  ineligible: "grey",
  dismissed: "grey",
  actioned: "wine",
  cancelled: "grey",
};

// The same plain words the rest of the site uses, instead of the database values.
const STATUS_WORDS: Record<string, string> = { actioned: "dealt with", onboarding: "signing up", ineligible: "under 35" };

export function Pill({ children, tone }: { children: ReactNode; tone?: string }) {
  const value = String(children);
  return <span className={`pill ${tone ?? STATUS_TONE[value] ?? "grey"}`}>{STATUS_WORDS[value] ?? value.replace(/_/g, " ")}</span>;
}

export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className={option.value === value ? "tab active" : "tab"}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function PageTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="page-title">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
      </div>
      {right}
    </header>
  );
}

export const ErrorBox = ({ message }: { message?: string }) => (message ? <div className="error-box">{message}</div> : null);

export const Empty = ({ children }: { children: ReactNode }) => <div className="empty-state">{children}</div>;

export function MemberLink({ member, showStatus }: { member: MemberSummary; showStatus?: boolean }) {
  return (
    <Link to={`/members/${member.id}`} className="member-link">
      <Photo objectKey={member.photoKey} size={40} zoom={false} />
      <span>
        <strong>{member.firstName ?? "No name yet"}</strong>
        <span className="muted"> {[member.age, member.gender, member.city].filter(Boolean).join(", ")}</span>
      </span>
      {showStatus ? <Pill>{member.status}</Pill> : null}
    </Link>
  );
}

export type { UserStatus };
