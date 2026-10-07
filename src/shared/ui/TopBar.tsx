import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "./AppText";
import { Icon } from "./Icon";
import { Wordmark } from "./Wordmark";

type TopBarProps = {
  /** Shown instead of the icecream wordmark. */
  title?: string;
  onBack?: () => void;
  /** At the right edge, e.g. the member's photo. */
  right?: ReactNode;
  /** Drawn under the bar, inside the same header (e.g. a progress bar). */
  children?: ReactNode;
};

/** The profile screens' header: back arrow, the wordmark or a title, and something on the right. */
export function TopBar({ title, onBack, right, children }: TopBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View className="gap-3 bg-ivory px-5 pb-2" style={{ paddingTop: insets.top + 8 }}>
      <View className="h-10 flex-row items-center gap-3">
        {onBack ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} onPress={onBack}>
            <Icon name="arrow-left" size={24} />
          </Pressable>
        ) : null}
        <View className="flex-1">
          {title ? (
            <AppText weight="bold" className="text-[17px]" numberOfLines={1}>
              {title}
            </AppText>
          ) : (
            <Wordmark />
          )}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}
