import { useSubscription } from "../SubscriptionProvider";

/** The one rule for "can this member send messages?", as decided by the server. */
export function useMessagingAccess() {
  const { billing } = useSubscription();
  return { hasMessagingAccess: billing?.canMessage ?? false, billing };
}
