import { View } from "react-native";

import { AppText } from "./AppText";
import { Icon } from "./Icon";
import { ONBOARDING_STEP_COUNT } from "./OnboardingHeader";

type StepLabelProps = {
  step: number;
  label: string;
  /** "pill" with a lock (Phone, Enter code) or "plain" with a trust mark on the right (Date of birth). */
  variant?: "pill" | "plain";
};

export function StepLabel({ step, label, variant = "pill" }: StepLabelProps) {
  const text = `STEP ${step} OF ${ONBOARDING_STEP_COUNT} • ${label.toUpperCase()}`;

  if (variant === "plain") {
    return (
      <View className="flex-row items-start justify-between gap-3">
        <AppText weight="bold" tone="muted" className="flex-1 text-xs tracking-wider">
          {text}
        </AppText>
        <View className="flex-row items-center gap-1">
          <Icon name="shield-check-outline" size={14} color="verified" />
          <AppText weight="semibold" tone="verified" className="text-xs">
            Private & Secure
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-row items-center gap-1.5 self-start rounded-full bg-sand px-3 py-1.5">
      <Icon name="lock-outline" size={13} color="inkMuted" />
      <AppText weight="bold" tone="muted" className="text-xs tracking-wider">
        {text}
      </AppText>
    </View>
  );
}
