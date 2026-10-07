import { Platform, type TextStyle } from "react-native";

/** Browsers draw a focus ring on inputs that the designs don't have; native has none. */
export const noWebFocusRing: TextStyle | undefined =
  Platform.OS === "web" ? { outlineWidth: 0 } : undefined;
