import type { BillingStatus } from "@contracts";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { useSession } from "@/features/auth";

import { getBillingStatus } from "./api/billingApi";

type SubscriptionValue = {
  /** Null until loaded (or when not signed in as a verified member). */
  billing: BillingStatus | null;
  refresh: () => Promise<BillingStatus | null>;
  setBilling: (billing: BillingStatus) => void;
};

const SubscriptionContext = createContext<SubscriptionValue | null>(null);

/** Whether the member can message, from the server (PRD 1.4: payment is the gate to speak). */
export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [billing, setBilling] = useState<BillingStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await getBillingStatus();
      setBilling(next);
      return next;
    } catch {
      return null;
    }
  }, []);

  // Load once the member is verified and signed in.
  useEffect(() => {
    if (status !== "active") return;
    let cancelled = false;
    getBillingStatus().then(
      (next) => !cancelled && setBilling(next),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [status]);

  // Only a verified, signed-in member has a billing status; anyone else gets null.
  const visible = status === "active" ? billing : null;
  const value = useMemo(() => ({ billing: visible, refresh, setBilling }), [visible, refresh]);
  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const subscription = useContext(SubscriptionContext);
  if (!subscription) throw new Error("useSubscription must be used inside <SubscriptionProvider>");
  return subscription;
}
