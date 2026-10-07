import type { ReactNode } from "react";
import { View } from "react-native";

import { AppText } from "./AppText";
import { Icon, type IconName } from "./Icon";
import type { ColorName } from "./theme";

type NoticeCardProps = {
  icon: IconName;
  iconColor?: ColorName;
  /** "square" sits in a sand square; "circle" in a white circle (Phone number screen). */
  iconShape?: "square" | "circle";
  title: string;
  children: ReactNode;
};

/** Reassurance and privacy notice on a sand background (components frame, section 6). */
export function NoticeCard({ icon, iconColor = "verified", iconShape = "square", title, children }: NoticeCardProps) {
  return (
    <View className="flex-row gap-3 rounded-2xl bg-sand p-4">
      <View
        className={`h-10 w-10 items-center justify-center bg-white ${iconShape === "circle" ? "rounded-full" : "rounded-lg"}`}
      >
        <Icon name={icon} size={20} color={iconColor} />
      </View>
      <View className="flex-1 gap-1">
        <AppText weight="bold" className="text-base">
          {title}
        </AppText>
        <AppText tone="muted" className="text-sm leading-5">
          {children}
        </AppText>
      </View>
    </View>
  );
}
