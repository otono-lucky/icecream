import type { Me } from "@contracts";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { ApiError, setAuthToken, setUnauthorizedHandler } from "@/shared/lib/apiClient";
import { tokenStorage } from "@/shared/lib/tokenStorage";

import { getMe, signOutRemote } from "../api/authApi";

/**
 * Drives which route group is reachable (see src/app/_layout.tsx):
 * signedOut → (public), onboarding → (onboarding), active → (app).
 * A member is only `active` once the server says verification passed (PRD 3.1).
 */
export type SessionStatus = "loading" | "unreachable" | "signedOut" | "onboarding" | "active";

type SessionValue = {
  status: SessionStatus;
  me: Me | null;
  signIn: (token: string, me: Me) => Promise<void>;
  /** Store the latest Me returned by any endpoint; the status follows it. */
  setMe: (me: Me) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

const statusFor = (me: Me): SessionStatus => (me.onboarding.nextStep === "done" ? "active" : "onboarding");

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [me, setMeState] = useState<Me | null>(null);

  const setMe = useCallback((next: Me) => {
    setMeState(next);
    setStatus(statusFor(next));
  }, []);

  const clearLocalSession = useCallback(async () => {
    setAuthToken(null);
    await tokenStorage.clear();
    setMeState(null);
    setStatus("signedOut");
  }, []);

  const refresh = useCallback(async () => {
    try {
      setMe(await getMe());
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return clearLocalSession();
      if (error instanceof ApiError && error.code === "network_error") {
        // Keep the token: the member is still signed in, we just can't reach the server yet.
        setStatus((current) => (current === "loading" || current === "unreachable" ? "unreachable" : current));
        return;
      }
      throw error;
    }
  }, [clearLocalSession, setMe]);

  // Restore a saved session on launch so returning members go straight in (PRD 4.1).
  useEffect(() => {
    setUnauthorizedHandler(() => void clearLocalSession());
    void (async () => {
      const token = await tokenStorage.get();
      if (!token) return setStatus("signedOut");
      setAuthToken(token);
      await refresh();
    })();
    return () => setUnauthorizedHandler(null);
  }, [clearLocalSession, refresh]);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      me,
      setMe,
      refresh,
      signIn: async (token, nextMe) => {
        setAuthToken(token);
        await tokenStorage.set(token);
        setMe(nextMe);
      },
      signOut: async () => {
        await signOutRemote().catch(() => undefined);
        await clearLocalSession();
      },
    }),
    [status, me, setMe, refresh, clearLocalSession],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error("useSession must be used inside <SessionProvider>");
  }
  return session;
}

/** For screens that only render with a signed-in member (onboarding and app groups). */
export function useMe(): Me {
  const { me } = useSession();
  if (!me) {
    throw new Error("useMe used without a signed-in member");
  }
  return me;
}
