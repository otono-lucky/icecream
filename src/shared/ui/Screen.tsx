import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "./AppText";

type ScreenProps = {
  /** Fixed above the scrolling content, e.g. <OnboardingHeader />. */
  header?: ReactNode;
  title?: string;
  subtitle?: string;
  /** Pad for the status bar on screens with neither a navigation header nor a custom one. */
  safeTop?: boolean;
  children?: ReactNode;
};

export function Screen({ header, title, subtitle, safeTop, children }: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-ivory">
      {header}
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-5"
        // Always set a top padding: leaving it undefined here wiped out the class's spacing, so titles
        // sat right against the navigation bar on every screen that has one.
        contentContainerStyle={{ paddingTop: safeTop ? insets.top + 16 : 24, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {title || subtitle ? (
          <View className="gap-1.5">
            {title ? (
              <AppText weight="bold" className="text-[26px] leading-8">
                {title}
              </AppText>
            ) : null}
            {subtitle ? (
              <AppText tone="muted" className="text-[17px] leading-6">
                {subtitle}
              </AppText>
            ) : null}
          </View>
        ) : null}
        {children}
      </ScrollView>
    </View>
  );
}
