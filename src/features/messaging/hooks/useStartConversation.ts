import { router } from "expo-router";
import { useCallback } from "react";

import { useMessagingAccess } from "@/features/subscription";
import { routes } from "@/shared/navigation/routes";

/** What happens when a member taps Message: straight into the chat, or the paywall at the point of intent. */
export function useStartConversation() {
  const { hasMessagingAccess } = useMessagingAccess();

  return useCallback(
    (member: { id: string; firstName: string }) => {
      router.push(hasMessagingAccess ? routes.chat(member.id) : routes.paywall(member.id, member.firstName));
    },
    [hasMessagingAccess],
  );
}
