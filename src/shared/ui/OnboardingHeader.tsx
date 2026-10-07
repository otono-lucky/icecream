import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "./Icon";
import { Wordmark } from "./Wordmark";

export const ONBOARDING_STEP_COUNT = 6;

type OnboardingHeaderProps = {
  step: number;
  /** Where the back arrow goes. Defaults to the previous screen, when there is one. */
  onBack?: () => void;
};

/** Top of every onboarding step: back, wordmark, trust marks, and a 6-segment progress bar. */
export function OnboardingHeader({ step, onBack }: OnboardingHeaderProps) {
  const insets = useSafeAreaInsets();
  const back = onBack ?? (router.canGoBack() ? () => router.back() : undefined);

  return (
    <View className="gap-3 bg-ivory px-5 pb-2" style={{ paddingTop: insets.top + 8 }}>
      <View className="h-10 flex-row items-center gap-3">
        {back ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} onPress={back}>
            <Icon name="chevron-left" size={28} />
          </Pressable>
        ) : null}
        <View className="flex-1">
          <Wordmark />
        </View>
        <Icon name="shield-check-outline" size={20} color="verified" />
        <View className="h-8 w-8 items-center justify-center rounded-full bg-wine">
          <Icon name="account" size={18} color="white" />
        </View>
      </View>
      <View
        className="flex-row gap-1.5"
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: ONBOARDING_STEP_COUNT, now: step }}
      >
        {Array.from({ length: ONBOARDING_STEP_COUNT }, (_, index) => (
          <View key={index} className={`h-1 flex-1 rounded-full ${index < step ? "bg-wine" : "bg-sand-dark"}`} />
        ))}
      </View>
    </View>
  );
}
