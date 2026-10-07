import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { ApiError, errorMessage } from "@/shared/lib/apiClient";
import { AppText, Button, ErrorText, Icon, NoticeCard, OnboardingHeader, Screen, StepLabel } from "@/shared/ui";

import { requestOtp, verifyOtp } from "../api/authApi";
import { CodeBoxes } from "../components/CodeBoxes";
import { useSession } from "../session/SessionProvider";

const RESEND_SECONDS = 60;

const HELP =
  "Check the email address above is right, and look in your spam or promotions folder. Codes can take a minute to arrive. If it still doesn’t come, tap Resend code.";

export function OtpScreen() {
  const { to } = useLocalSearchParams<{ to: string }>();
  const { signIn } = useSession();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [expired, setExpired] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function handleVerify() {
    setVerifying(true);
    setError(undefined);
    try {
      const { token, me } = await verifyOtp(to, code);
      // The session status changes here and the root layout's guards move the member on.
      await signIn(token, me);
    } catch (e) {
      if (e instanceof ApiError && e.code === "code_expired") setExpired(true);
      setError(errorMessage(e));
      setVerifying(false);
    }
  }

  async function handleResend() {
    setError(undefined);
    try {
      await requestOtp(to);
      setExpired(false);
      setCode("");
      setResendIn(RESEND_SECONDS);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Screen header={<OnboardingHeader step={1} />}>
      <StepLabel step={1} label="Identity verification" />
      <View className="gap-1.5">
        <AppText weight="bold" className="text-[26px] leading-8">
          Enter your code
        </AppText>
        <AppText tone="muted" className="text-[17px] leading-6">
          Sent by email to{" "}
          <AppText weight="bold" className="text-[17px]">
            {to}
          </AppText>
          {"  "}
          <AppText weight="bold" tone="wine" className="text-[15px]" onPress={() => router.back()}>
            Edit
          </AppText>
        </AppText>
      </View>

      <View className="gap-3">
        <CodeBoxes
          value={code}
          onChange={(value) => {
            setError(undefined);
            setCode(value);
          }}
        />
        {error ? <ErrorText message={error} /> : null}
      </View>

      <View className="flex-row items-center gap-2 self-center rounded-full bg-sand px-4 py-2">
        <Icon name="clock-outline" size={16} color="inkMuted" />
        {resendIn > 0 && !expired ? (
          <AppText weight="medium" tone="muted" className="text-sm">
            Resend code in {resendIn}s
          </AppText>
        ) : (
          <>
            <AppText weight="medium" tone="muted" className="text-sm">
              {expired ? "Code expired" : "Didn’t get it?"}
            </AppText>
            <AppText tone="faint" className="text-sm">
              •
            </AppText>
            <Pressable accessibilityRole="button" onPress={handleResend} hitSlop={8}>
              <AppText weight="bold" tone="wine" className="text-sm underline">
                Resend code
              </AppText>
            </Pressable>
          </>
        )}
      </View>

      <NoticeCard icon="shield-account-outline" title="Dignified & Protected Communication">
        We never share your email address with prospective suitors.
        Your security and peace of mind remain absolute.
      </NoticeCard>

      <View className="gap-2 pt-2">
        <Button
          label={verifying ? "Checking…" : "Verify"}
          trailingIcon={verifying ? undefined : "arrow-right"}
          disabled={code.length !== 6 || verifying}
          onPress={handleVerify}
        />
        <Button label="Need help receiving code?" variant="text" strong onPress={() => setShowHelp((shown) => !shown)} />
        {showHelp ? (
          <AppText tone="muted" className="text-center text-sm leading-5">
            {HELP}
          </AppText>
        ) : null}
      </View>
    </Screen>
  );
}
