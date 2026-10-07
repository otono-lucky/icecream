import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { View } from "react-native";

import { useMe } from "@/features/auth";
import { errorMessage } from "@/shared/lib/apiClient";
import { AppText, Button, ErrorBanner, Icon, OnboardingHeader, Screen, StepMeta, type IconName } from "@/shared/ui";

import { submitLivenessSelfie } from "../api/verificationApi";
import { onboardingBack, useAdvanceOnboarding } from "../onboardingSteps";

const TIPS: { icon: IconName; label: string }[] = [
  { icon: "white-balance-sunny", label: "Good light" },
  { icon: "sunglasses", label: "No sunglasses" },
  { icon: "account-outline", label: "Just you" },
];

/** One corner bracket of the camera frame. */
function Corner({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const top = position[0] === "t";
  const left = position[1] === "l";
  return (
    <View
      className="absolute h-8 w-8 border-wine"
      style={{
        top: top ? 0 : undefined,
        bottom: top ? undefined : 0,
        left: left ? 0 : undefined,
        right: left ? undefined : 0,
        borderTopWidth: top ? 3 : 0,
        borderBottomWidth: top ? 0 : 3,
        borderLeftWidth: left ? 3 : 0,
        borderRightWidth: left ? 0 : 3,
        borderTopLeftRadius: position === "tl" ? 14 : 0,
        borderTopRightRadius: position === "tr" ? 14 : 0,
        borderBottomLeftRadius: position === "bl" ? 14 : 0,
        borderBottomRightRadius: position === "br" ? 14 : 0,
      }}
    />
  );
}

/**
 * MVP liveness: a live selfie from the front camera, compared with the member's photos by a
 * reviewer. An automated liveness vendor can replace this screen's capture step later.
 */
export function LivenessScreen() {
  const me = useMe();
  const { liveness } = me.verification;
  const alreadySent = liveness.state === "pending" || liveness.state === "passed";
  const advance = useAdvanceOnboarding();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function handleCapture() {
    setError(undefined);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError("icecream needs camera access for this check. You can allow it in your phone's settings.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ cameraType: ImagePicker.CameraType.front, quality: 0.7 });
    if (result.canceled) return;

    setBusy(true);
    try {
      // A new selfie goes wherever the member is needed next (after a retake, straight back to waiting),
      // not one screen forward: stepping in order is only for Continue on a step already done.
      advance(await submitLivenessSelfie(result.assets[0]));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      // The screen stays in the back stack after moving on; reset so going back isn't stuck on "Uploading…".
      setBusy(false);
    }
  }

  return (
    <Screen header={<OnboardingHeader step={5} onBack={onboardingBack("liveness")} />}>
      <StepMeta label="Step 5 of 6 • Verification" right={{ kind: "pill", label: "Secure" }} />
      <View className="gap-1.5">
        <AppText weight="bold" className="text-[26px] leading-8">
          A quick selfie
        </AppText>
        <AppText tone="muted" className="text-[17px] leading-6">
          {alreadySent
            ? "We have your selfie. You don’t need to take another."
            : "Take a selfie now so we can match it to your photos."}
        </AppText>
      </View>

      <View className="gap-4 rounded-3xl bg-sand px-4 pb-4 pt-6">
        <View className="items-center">
          <View className="h-64 w-52 items-center justify-center">
            <Corner position="tl" />
            <Corner position="tr" />
            <Corner position="bl" />
            <Corner position="br" />
            <View className="h-56 w-44 items-center justify-end overflow-hidden rounded-full bg-white">
              <Icon name="account" size={170} color="sand" />
            </View>
            <View className="absolute bottom-3 flex-row items-center gap-1.5 rounded-full bg-sand-dark px-3 py-1.5">
              <Icon name="camera-outline" size={14} color="wine" />
              <AppText weight="semibold" className="text-xs">
                Look forward & smile
              </AppText>
            </View>
          </View>
        </View>
        <View className="flex-row justify-between">
          {TIPS.map((tip) => (
            <View key={tip.label} className="flex-row items-center gap-1.5">
              <Icon name={tip.icon} size={16} color="inkMuted" />
              <AppText weight="semibold" tone="muted" className="text-xs">
                {tip.label}
              </AppText>
            </View>
          ))}
        </View>
      </View>

      <View className="gap-2 rounded-2xl bg-white p-4">
        <View className="flex-row items-center gap-2">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-sand">
            <Icon name="shield-check-outline" size={18} color="wine" />
          </View>
          <AppText weight="bold" className="text-lg">
            Why we ask
          </AppText>
        </View>
        <AppText tone="muted" className="text-[15px] leading-6">
          Every member passes this same check, so you know everyone you meet here is a real person. A person on our
          team compares it with your photos. Your selfie is never shown on your profile.
        </AppText>
      </View>

      {liveness.state === "failed" ? (
        <View className="gap-3 rounded-2xl bg-peach p-4">
          <View className="flex-row items-start gap-3">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-white">
              <Icon name="alarm-light-outline" size={18} color="wine" />
            </View>
            <AppText weight="bold" className="flex-1 text-[15px] leading-5">
              We couldn’t confirm your last selfie
            </AppText>
            <View className="rounded-full bg-peach-deep px-2.5 py-1">
              <AppText weight="bold" tone="white" className="text-[11px]">
                Notice
              </AppText>
            </View>
          </View>
          <View className="gap-1 rounded-xl bg-white p-3">
            <AppText weight="bold" tone="muted" className="text-[11px] tracking-wider">
              REVIEWER’S REASON
            </AppText>
            <AppText className="text-[15px] leading-5">“{liveness.failureReason}”</AppText>
          </View>
        </View>
      ) : null}

      {error ? <ErrorBanner message={error} /> : null}
      {alreadySent ? (
        <Button label="Continue" trailingIcon="arrow-right" onPress={() => advance(me, "liveness")} />
      ) : (
        <View className="gap-1">
          <Button
            label={busy ? "Uploading…" : "Take my selfie"}
            leadingIcon={busy ? undefined : "camera-outline"}
            disabled={busy}
            onPress={handleCapture}
          />
        </View>
      )}
    </Screen>
  );
}
