import type { ReactNode } from "react";

import { SessionProvider } from "@/features/auth";
import { SubscriptionProvider } from "@/features/subscription";

/** Composition root: the only place app-wide providers are stacked. Order matters, session first. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <SubscriptionProvider>{children}</SubscriptionProvider>
    </SessionProvider>
  );
}
