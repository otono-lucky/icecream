import { View } from "react-native";

import { AppText } from "./AppText";

export function Wordmark({ size = "sm" }: { size?: "sm" | "md" }) {
  return (
    <View className="flex-row items-center gap-1">
      <AppText weight="extrabold" tone="wine" className={size === "sm" ? "text-base" : "text-xl"}>
        icecream
      </AppText>
      <View className="h-1.5 w-1.5 rounded-full bg-wine" />
    </View>
  );
}
