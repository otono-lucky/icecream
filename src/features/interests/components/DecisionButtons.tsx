import type { Decision, MemberCard } from "@contracts";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { colors, Icon } from "@/shared/ui";

type DecisionButtonsProps = {
  card: MemberCard;
  saving: Decision | undefined;
  onDecide: (decision: Decision) => void;
  /** Shown between the two round buttons, e.g. "View profile". */
  children?: ReactNode;
  /** An extra round button just before Interested, e.g. Message. */
  extra?: ReactNode;
};

/** Round Pass and Interested buttons either side of a main action. Free and private (PRD 4.3). */
export function DecisionButtons({ card, saving, onDecide, children, extra }: DecisionButtonsProps) {
  const interested = card.decision === "interest";
  const passed = card.decision === "pass";

  return (
    <View className={`flex-row items-center ${extra ? "gap-2" : "gap-3"}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Pass on ${card.firstName}`}
        accessibilityState={{ selected: passed }}
        onPress={() => onDecide("pass")}
        className={`h-[52px] w-[52px] items-center justify-center rounded-full ${passed ? "bg-ink-muted" : "bg-sand active:bg-sand-dark"}`}
      >
        {saving === "pass" ? (
          <ActivityIndicator color={colors.inkMuted} />
        ) : (
          <Icon name="close" size={24} color={passed ? "white" : "inkMuted"} />
        )}
      </Pressable>
      <View className="flex-1">{children}</View>
      {extra}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`I’m interested in ${card.firstName}`}
        accessibilityState={{ selected: interested }}
        onPress={() => onDecide("interest")}
        className={`h-[52px] w-[52px] items-center justify-center rounded-full ${interested ? "bg-wine-soft" : "bg-wine active:bg-wine-dark"}`}
      >
        {saving === "interest" ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Icon name={interested ? "heart" : "heart-outline"} size={24} color={interested ? "wine" : "white"} />
        )}
      </Pressable>
    </View>
  );
}
