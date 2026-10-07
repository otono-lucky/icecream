import { View } from "react-native";

import { AppText } from "./AppText";
import { Icon, type IconName } from "./Icon";

type Right =
  | { kind: "mark"; label: string; icon?: IconName } // green icon + text, e.g. "Private & Verified"
  | { kind: "pill"; label: string } // green pill, e.g. "Secure"
  | { kind: "text"; label: string }; // wine text, e.g. "STEP 6 OF 6"

/** The small line under the progress bar: what this step is, and a trust mark on the right. */
export function StepMeta({ label, right }: { label: string; right?: Right }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <AppText weight="bold" tone="muted" className="flex-1 text-xs tracking-wider">
        {label.toUpperCase()}
      </AppText>
      {right?.kind === "mark" ? (
        <View className="flex-row items-center gap-1">
          <Icon name={right.icon ?? "shield-check"} size={14} color="verified" />
          <AppText weight="semibold" tone="verified" className="text-xs">
            {right.label}
          </AppText>
        </View>
      ) : right?.kind === "pill" ? (
        <View className="flex-row items-center gap-1 rounded-full bg-verified-soft px-2.5 py-1">
          <Icon name="shield-lock-outline" size={12} color="verified" />
          <AppText weight="bold" tone="verified" className="text-xs">
            {right.label}
          </AppText>
        </View>
      ) : right?.kind === "text" ? (
        <AppText weight="bold" tone="wine" className="text-xs tracking-wider">
          {right.label.toUpperCase()}
        </AppText>
      ) : null}
    </View>
  );
}
