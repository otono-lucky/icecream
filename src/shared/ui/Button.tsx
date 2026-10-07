import { Pressable, View } from "react-native";

import { AppText } from "./AppText";
import { Icon, type IconName } from "./Icon";

type ButtonVariant = "primary" | "secondary" | "dark" | "text";

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  trailingIcon?: IconName;
  leadingIcon?: IconName;
  /** Text buttons are medium weight by default; some designs set them bold. */
  strong?: boolean;
};

const containerClass: Record<ButtonVariant, string> = {
  primary: "bg-wine active:bg-wine-dark",
  secondary: "bg-sand active:bg-sand-dark",
  dark: "bg-charcoal active:bg-ink",
  text: "active:bg-sand",
};

// Components frame: 52pt primary buttons, rounded 12, disabled buttons turn sand with a label saying why.
export function Button({ label, onPress, variant = "primary", disabled, trailingIcon, leadingIcon, strong }: ButtonProps) {
  const filled = variant === "primary" || variant === "dark";
  const tone = disabled && variant !== "text" ? "faint" : filled ? "white" : "ink";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-[52px] flex-row items-center justify-center gap-2 rounded-xl px-5 ${
        disabled && variant !== "text" ? "bg-sand-dark" : containerClass[variant]
      }`}
    >
      {leadingIcon ? (
        <Icon name={leadingIcon} size={18} color={tone === "white" ? "white" : tone === "faint" ? "inkFaint" : "ink"} />
      ) : null}
      <AppText weight={variant === "text" && !strong ? "medium" : "bold"} tone={tone} className="text-base">
        {label}
      </AppText>
      {trailingIcon ? (
        <View>
          <Icon name={trailingIcon} size={18} color={tone === "white" ? "white" : tone === "faint" ? "inkFaint" : "ink"} />
        </View>
      ) : null}
    </Pressable>
  );
}
