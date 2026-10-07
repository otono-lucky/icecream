import { Text, type TextProps } from "react-native";

type Weight = "regular" | "medium" | "semibold" | "bold" | "extrabold";
type Tone = "ink" | "muted" | "faint" | "wine" | "white" | "verified" | "review" | "danger";

const weightClass: Record<Weight, string> = {
  regular: "font-body",
  medium: "font-body-medium",
  semibold: "font-body-semibold",
  bold: "font-body-bold",
  extrabold: "font-body-extrabold",
};

const toneClass: Record<Tone, string> = {
  ink: "text-ink",
  muted: "text-ink-muted",
  faint: "text-ink-faint",
  wine: "text-wine",
  white: "text-white",
  verified: "text-verified",
  review: "text-review",
  danger: "text-danger",
};

type AppTextProps = TextProps & {
  weight?: Weight;
  tone?: Tone;
  /** Size, spacing and layout only. Font and colour come from `weight` and `tone`. */
  className?: string;
};

/** All text in the app goes through this, so every string uses the design system's font. */
export function AppText({ weight = "regular", tone = "ink", className = "", ...props }: AppTextProps) {
  return <Text className={`${weightClass[weight]} ${toneClass[tone]} ${className}`} {...props} />;
}
