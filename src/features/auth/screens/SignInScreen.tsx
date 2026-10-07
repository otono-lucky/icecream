import { normalizeEmail } from "@contracts";
import { router } from "expo-router";
import { useState } from "react";
import { TextInput, View } from "react-native";

import { ApiError, errorMessage } from "@/shared/lib/apiClient";
import { routes } from "@/shared/navigation/routes";
import {
  AppText,
  Button,
  colors,
  ErrorBanner,
  Icon,
  noWebFocusRing,
  NoticeCard,
  OnboardingHeader,
  Screen,
  StepLabel,
} from "@/shared/ui";

import { requestOtp } from "../api/authApi";

/** Sign up or sign in with an email address. A code is emailed to it. */
export function SignInScreen() {
  const [value, setValue] = useState("");
  const [blurred, setBlurred] = useState(false);
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const normalized = normalizeEmail(value);

  // Checked once the member leaves the field, so typing isn't interrupted by an error.
  const looksDone = blurred && value.trim().length > 0;
  const shownError = error ?? (looksDone && !normalized ? "Enter a valid email address." : undefined);

  async function handleContinue() {
    if (!normalized) return;
    setSending(true);
    setError(undefined);
    try {
      const { to } = await requestOtp(normalized);
      router.push(routes.otp(to));
    } catch (e) {
      // A code was sent moments ago and is still valid, so carry on to enter it.
      if (e instanceof ApiError && e.code === "resend_too_soon") router.push(routes.otp(normalized));
      else setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen header={<OnboardingHeader step={1} />}>
      <StepLabel step={1} label="Identity verification" />
      <View className="gap-1.5">
        <AppText weight="bold" className="text-[26px] leading-8">
          Your email address
        </AppText>
        <AppText tone="muted" className="text-[17px] leading-6">
          We’ll email you a code.
        </AppText>
      </View>

      <View className="gap-2">
        <AppText weight="bold" className="text-sm">
          Email address
        </AppText>
        <View className="min-h-[56px] flex-row items-center rounded-xl border border-sand-dark bg-white">
          <View className="flex-row items-center gap-2 self-stretch border-r border-sand-dark px-4">
            <Icon name="email-outline" size={22} color="inkMuted" />
          </View>
          <TextInput
            accessibilityLabel="Email address"
            className="flex-1 px-4 py-3 font-body text-lg text-ink"
            placeholderTextColor={colors.inkFaint}
            style={noWebFocusRing}
            onBlur={() => setBlurred(true)}
            value={value}
            onChangeText={(text) => {
              setError(undefined);
              setValue(text);
            }}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={254}
            returnKeyType="send"
            onSubmitEditing={() => void handleContinue()}
          />
        </View>
        {shownError ? <ErrorBanner message={shownError} /> : null}
      </View>

      <NoticeCard icon="shield-check" iconShape="circle" title="Strict Discretion Assured">
        We never share your email or show it to other members. Your contact details remain confidential.
      </NoticeCard>

      <View className="gap-2 pt-2">
        <Button
          label={sending ? "Sending…" : "Send code"}
          trailingIcon={sending ? undefined : "arrow-right"}
          disabled={!normalized || sending}
          onPress={handleContinue}
        />
      </View>
    </Screen>
  );
}
