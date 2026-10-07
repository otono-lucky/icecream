import { useRef } from "react";
import { Pressable, TextInput, View } from "react-native";

import { AppText } from "@/shared/ui";

const LENGTH = 6;

type CodeBoxesProps = {
  value: string;
  onChange: (value: string) => void;
};

/**
 * Six digit boxes over one hidden input, so pasting a code still works.
 * The box the next digit goes into (or the last one when full) is highlighted.
 */
export function CodeBoxes({ value, onChange }: CodeBoxesProps) {
  const input = useRef<TextInput>(null);
  const activeIndex = Math.min(value.length, LENGTH - 1);

  return (
    <Pressable accessibilityLabel="6-digit code" onPress={() => input.current?.focus()}>
      <View className="flex-row justify-between gap-2">
        {Array.from({ length: LENGTH }, (_, index) => {
          const active = index === activeIndex;
          return (
            <View
              key={index}
              className={`h-14 flex-1 items-center justify-center rounded-xl border ${
                active ? "border-wine bg-wine-soft" : "border-sand-dark bg-white"
              }`}
            >
              <AppText weight="bold" tone={active ? "wine" : "ink"} className="text-2xl">
                {value[index] ?? ""}
              </AppText>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={input}
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, "").slice(0, LENGTH))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={LENGTH}
        autoFocus
        caretHidden
        className="absolute h-full w-full opacity-0"
      />
    </Pressable>
  );
}
