import { TextInput, View, type TextInputProps } from "react-native";

import { AppText } from "./AppText";
import { ErrorBanner } from "./ErrorBanner";
import { noWebFocusRing } from "./inputStyle";
import { colors } from "./theme";

type FieldProps = TextInputProps & {
  label: string;
  error?: string;
};

export function Field({ label, error, ...inputProps }: FieldProps) {
  return (
    <View className="gap-2">
      <AppText weight="bold" className="text-sm">
        {label}
      </AppText>
      <TextInput
        className="min-h-[56px] rounded-xl border border-sand-dark bg-white px-4 font-body text-lg text-ink"
        placeholderTextColor={colors.inkFaint}
        style={noWebFocusRing}
        {...inputProps}
      />
      {error ? <ErrorBanner message={error} /> : null}
    </View>
  );
}
