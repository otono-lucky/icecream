import { View } from "react-native";

import { AppText } from "./AppText";
import { Icon } from "./Icon";

/** Plain-language error under an input, on a soft red band (Phone number screen). */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <View accessibilityRole="alert" className="flex-row items-center gap-2 rounded-lg bg-danger-soft px-3 py-2.5">
      <Icon name="alert-circle-outline" size={16} color="danger" />
      <AppText tone="danger" className="flex-1 text-sm">
        {message}
      </AppText>
    </View>
  );
}

/** Inline variant without the band (Enter code screen). */
export function ErrorText({ message }: { message: string }) {
  return (
    <View accessibilityRole="alert" className="flex-row items-start gap-2">
      <Icon name="alert-circle" size={16} color="danger" />
      <AppText weight="semibold" tone="danger" className="flex-1 text-sm">
        {message}
      </AppText>
    </View>
  );
}
