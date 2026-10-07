import type { AdminSignInResponse } from "@contracts";
import { useState, type FormEvent } from "react";

import { api, ApiError, errorMessage, setSession } from "../api";
import { ErrorBox } from "../ui";

/** Admins sign in with a code emailed to them. Only addresses added with `npm run admin -- add` get one. */
export function SignIn() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const requestCode = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      try {
        await api("/auth/request", { json: { email } });
      } catch (e) {
        // A code was sent moments ago and still works: go straight to entering it.
        if (!(e instanceof ApiError && e.code === "resend_too_soon")) throw e;
      }
      setStep("code");
    });
  };

  const verify = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => setSession(await api<AdminSignInResponse>("/auth/verify", { json: { email, code } })));
  };

  return (
    <main className="sign-in">
      <div className="card sign-in-card">
        <div className="wordmark">
          icecream<span className="dot" />
          <span className="wordmark-tag">Admin</span>
        </div>
        {step === "email" ? (
          <form onSubmit={requestCode} className="stack">
            <h1>Sign in</h1>
            <p className="muted">For the icecream team only. We’ll email you a code.</p>
            <label className="field">
              <span>Work email</span>
              <input type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <ErrorBox message={error} />
            <button type="submit" className="button primary" disabled={busy || !email.trim()}>
              {busy ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="stack">
            <h1>Enter your code</h1>
            <p className="muted">
              If <strong>{email}</strong> is on the admin list, a 6-digit code is on its way. It expires in 10 minutes.
            </p>
            <label className="field">
              <span>Code</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="code-input"
              />
            </label>
            <ErrorBox message={error} />
            <button type="submit" className="button primary" disabled={busy || code.length !== 6}>
              {busy ? "Checking…" : "Sign in"}
            </button>
            <button
              type="button"
              className="button text"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(undefined);
              }}
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
