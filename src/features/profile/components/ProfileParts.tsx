import type { ReactNode } from "react";
import { Pressable, TextInput, View, type TextInputProps } from "react-native";

import { useMe } from "@/features/auth";
import { myPhotoPath } from "@/shared/lib/apiPaths";
import { AppText, AuthImage, colors, Icon, noWebFocusRing, type IconName } from "@/shared/ui";
import type { ColorName } from "@/shared/ui/theme";

/** The member's own main photo, small and round, at the right of the profile screens' top bar. */
export function MyAvatar({ size = 32 }: { size?: number }) {
  const photo = useMe().photos[0];
  return (
    <View className="overflow-hidden rounded-full bg-sand" style={{ width: size, height: size }}>
      {photo ? <AuthImage path={myPhotoPath(photo.id)} style={{ width: size, height: size }} /> : null}
    </View>
  );
}

/** A question heading, with an optional line of help under it and something on the right. */
export function Question({ title, help, right, large }: { title: string; help?: string; right?: ReactNode; large?: boolean }) {
  return (
    <View className="gap-1">
      <View className="flex-row items-center justify-between gap-3">
        <AppText weight="bold" className={`flex-1 ${large ? "text-[20px] leading-7" : "text-base"}`}>
          {title}
        </AppText>
        {right}
      </View>
      {help ? (
        <AppText tone="muted" className="text-sm leading-5">
          {help}
        </AppText>
      ) : null}
    </View>
  );
}

type ChoiceCardProps = {
  label: string;
  hint?: string;
  icon?: IconName;
  selected: boolean;
  onPress: () => void;
  /** Radio on the left (Where you live) instead of the right. */
  radioLeft?: boolean;
};

/** A full-width single-choice answer. Selected: soft wine with a wine border and a check. */
export function ChoiceCard({ label, hint, icon, selected, onPress, radioLeft }: ChoiceCardProps) {
  const radio = selected ? (
    <View className="h-6 w-6 items-center justify-center rounded-full bg-wine">
      <Icon name="check" size={15} color="white" />
    </View>
  ) : (
    <View className="h-6 w-6 rounded-full bg-sand-dark" />
  );

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      className={`min-h-[56px] flex-row items-center gap-3 rounded-2xl border px-4 py-3.5 ${
        selected ? "border-wine bg-wine-soft/40" : "border-white bg-white active:bg-sand"
      }`}
    >
      {radioLeft ? radio : null}
      {icon ? (
        <View className={`h-10 w-10 items-center justify-center rounded-full ${selected ? "bg-wine" : "bg-sand"}`}>
          <Icon name={icon} size={20} color={selected ? "white" : "inkMuted"} />
        </View>
      ) : null}
      <View className="flex-1 gap-0.5">
        <AppText weight="semibold" tone={selected && !icon ? "wine" : "ink"} className="text-base">
          {label}
        </AppText>
        {hint ? (
          <AppText tone="muted" className="text-[13px] leading-[18px]">
            {hint}
          </AppText>
        ) : null}
      </View>
      {radioLeft ? null : radio}
    </Pressable>
  );
}

type TileProps = { label: string; selected: boolean; onPress: () => void; icon?: IconName };

/** A smaller answer that sits side by side with others (Yes / No, Yes / Maybe / No). */
export function ChoiceTile({ label, selected, onPress, icon }: TileProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      className={`min-h-[56px] flex-1 flex-row items-center gap-2 rounded-2xl border px-3 py-3 ${
        selected ? "border-wine bg-wine-soft/40" : "border-white bg-white active:bg-sand"
      }`}
    >
      {icon ? <Icon name={icon} size={20} color={selected ? "wine" : "inkMuted"} /> : null}
      <AppText weight="semibold" className="flex-1 text-base">
        {label}
      </AppText>
      {selected ? (
        <View className="h-5 w-5 items-center justify-center rounded-full bg-wine">
          <Icon name="check" size={13} color="white" />
        </View>
      ) : (
        <View className="h-5 w-5 rounded-full border border-sand-dark" />
      )}
    </Pressable>
  );
}

/** Square answers with a check mark above the label (Are you open to a partner who has children?). */
export function StackedTile({ label, selected, onPress }: TileProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      className={`min-h-[64px] flex-1 items-center justify-center gap-1.5 rounded-2xl border py-3 ${
        selected ? "border-wine bg-wine-soft/40" : "border-white bg-white active:bg-sand"
      }`}
    >
      <Icon name={selected ? "check-circle" : "check-circle-outline"} size={20} color={selected ? "wine" : "inkFaint"} />
      <AppText weight="semibold" className="text-[15px]">
        {label}
      </AppText>
    </Pressable>
  );
}

/** A row of number pills (How many?). */
export function PillRow<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | null | undefined;
  onChange: (value: T) => void;
}) {
  return (
    <View className="flex-row gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            className={`h-12 flex-1 items-center justify-center rounded-xl ${selected ? "bg-wine-dark" : "bg-white active:bg-sand"}`}
          >
            <AppText weight="semibold" tone={selected ? "white" : "ink"} className="text-base">
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

type TextBoxProps = Omit<TextInputProps, "value" | "onChangeText"> & {
  value: string;
  onChangeText: (text: string) => void;
  max: number;
  /** A small green note shown once something is written, e.g. "Thoughtfully detailed". */
  goodNote?: string;
};

/** A large multi-line answer with a character count. */
export function TextBox({ value, onChangeText, max, goodNote, ...props }: TextBoxProps) {
  return (
    <View className="gap-2 rounded-2xl bg-white p-4">
      <TextInput
        multiline
        value={value}
        onChangeText={onChangeText}
        maxLength={max}
        placeholderTextColor={colors.inkFaint}
        textAlignVertical="top"
        className="min-h-[120px] font-body text-base leading-6 text-ink"
        style={noWebFocusRing}
        {...props}
      />
      <View className="flex-row items-center justify-between">
        {goodNote && value.trim().length >= 40 ? (
          <View className="flex-row items-center gap-1">
            <Icon name="check-circle-outline" size={14} color="verified" />
            <AppText weight="semibold" tone="verified" className="text-xs">
              {goodNote}
            </AppText>
          </View>
        ) : (
          <View />
        )}
        <AppText weight="semibold" tone="muted" className="text-xs">
          {value.length} / {max}
        </AppText>
      </View>
    </View>
  );
}

type InfoCardProps = {
  icon: IconName;
  iconColor?: ColorName;
  /** Small coloured capitals above the text (e.g. "PRIVACY"), or a bold title. */
  kicker?: string;
  title?: string;
  children: ReactNode;
};

/** Sand card with an icon in a soft circle: privacy notes and gentle explanations. */
export function InfoCard({ icon, iconColor = "verified", kicker, title, children }: InfoCardProps) {
  const circle = iconColor === "verified" ? "bg-verified-soft" : iconColor === "wine" ? "bg-wine-soft" : "bg-white";
  return (
    <View className="flex-row gap-3 rounded-2xl bg-sand p-4">
      <View className={`h-9 w-9 items-center justify-center rounded-full ${circle}`}>
        <Icon name={icon} size={18} color={iconColor} />
      </View>
      <View className="flex-1 gap-1">
        {kicker ? (
          <AppText weight="bold" tone={iconColor === "wine" ? "wine" : "verified"} className="text-[11px] tracking-wider">
            {kicker.toUpperCase()}
          </AppText>
        ) : null}
        {title ? (
          <AppText weight="bold" className="text-[15px]">
            {title}
          </AppText>
        ) : null}
        <AppText tone="muted" className="text-[15px] leading-[22px]">
          {children}
        </AppText>
      </View>
    </View>
  );
}

/** One small line with a lock (or other) icon, under a button. */
export function FootNote({ icon = "lock-outline", children }: { icon?: IconName; children: ReactNode }) {
  return (
    <View className="flex-row items-center justify-center gap-1.5">
      <Icon name={icon} size={13} color="inkMuted" />
      <AppText weight="semibold" tone="muted" className="text-center text-xs">
        {children}
      </AppText>
    </View>
  );
}

/** Green verification badge, e.g. "PHOTO VERIFIED". */
export function VerifiedBadge({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-verified-soft px-2.5 py-1">
      <Icon name="check-circle" size={12} color="verified" />
      <AppText weight="bold" tone="verified" className="text-[11px] tracking-wide">
        {label}
      </AppText>
    </View>
  );
}
