import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";

import { colors, type ColorName } from "./theme";

export type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export function Icon({ name, size = 20, color = "ink" }: { name: IconName; size?: number; color?: ColorName }) {
  return <MaterialCommunityIcons name={name} size={size} color={colors[color]} />;
}
