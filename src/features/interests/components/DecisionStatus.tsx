import type { MemberCard } from "@contracts";
import { View } from "react-native";

import { AppText, Icon } from "@/shared/ui";

/**
 * One line saying where things stand with this member: interested, passed, mutual, or that they're
 * interested in you. Falls back to `fallback` (e.g. why they were suggested) when nothing's decided.
 */
export function DecisionStatus({ card, fallback }: { card: MemberCard; fallback?: string }) {
  const { decision, interestedInYou, firstName } = card;
  const [icon, text, tone] =
    decision === "interest" && interestedInYou
      ? (["heart", "You’re both interested.", "wine"] as const)
      : decision === "interest"
        ? (["heart", `You’re interested. We’ve let ${firstName} know.`, "wine"] as const)
        : decision === "pass"
          ? (["eye-off-outline", `You passed. ${firstName} won’t be told.`, "inkMuted"] as const)
          : interestedInYou
            ? (["heart-outline", `${firstName} is interested in you.`, "wine"] as const)
            : fallback
              ? (["creation-outline", fallback, "wine"] as const)
              : [undefined, undefined, undefined];
  if (!text) return null;

  return (
    <View className={`flex-row items-center gap-2 rounded-xl px-3 py-2.5 ${decision === "interest" || interestedInYou ? "bg-wine-soft" : "bg-sand"}`}>
      <Icon name={icon} size={16} color={tone} />
      <AppText weight="semibold" tone={tone === "inkMuted" ? "muted" : "ink"} className="flex-1 text-sm">
        {text}
      </AppText>
    </View>
  );
}
