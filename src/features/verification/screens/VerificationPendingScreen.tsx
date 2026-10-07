import type { VerificationState } from "@contracts";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { AppState, Pressable, View } from "react-native";

import { useMe, useSession } from "@/features/auth";
import { useMyProfile } from "@/features/profile";
import { routes } from "@/shared/navigation/routes";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText, Button, Icon, Screen, StepMeta, type IconName } from "@/shared/ui";

import { STEP_ROUTES } from "../onboardingSteps";

const POLL_MS = 20_000;

type State = VerificationState | "skipped";

const STATE_PILLS: Record<State, { label: string; box: string; tone: "review" | "muted" | "verified" | "danger"; icon?: IconName }> = {
  not_submitted: { label: "Not started", box: "bg-sand-dark", tone: "muted" },
  pending: { label: "Being reviewed", box: "bg-review-soft", tone: "review", icon: "loading" },
  passed: { label: "Passed", box: "bg-verified-soft", tone: "verified", icon: "check" },
  failed: { label: "Needs another try", box: "bg-danger-soft", tone: "danger" },
  skipped: { label: "Skipped", box: "bg-sand-dark", tone: "muted" },
};

function StatusCard({ icon, title, subtitle, state, note }: { icon: IconName; title: string; subtitle: string; state: State; note?: string }) {
  const pill = STATE_PILLS[state];
  return (
    <View className="gap-2 rounded-2xl bg-white p-4">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-sand">
          <Icon name={icon} size={20} color="inkMuted" />
        </View>
        <View className="flex-1">
          <AppText weight="bold" className="text-[15px]">
            {title}
          </AppText>
          <AppText weight="semibold" tone="muted" className="text-xs">
            {subtitle}
          </AppText>
        </View>
        <View className={`flex-row items-center gap-1 rounded-full px-2.5 py-1 ${pill.box}`}>
          {pill.icon ? <Icon name={pill.icon} size={12} color={pill.tone === "muted" ? "inkMuted" : pill.tone} /> : null}
          <AppText weight="bold" tone={pill.tone} className="text-[11px]">
            {pill.label}
          </AppText>
        </View>
      </View>
      {note ? (
        <View className="flex-row items-center gap-1.5">
          <Icon name="information-outline" size={13} color="inkMuted" />
          <AppText weight="semibold" tone="muted" className="text-xs">
            {note}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

export function VerificationPendingScreen() {
  const me = useMe();
  const { refresh } = useSession();
  const { liveness, governmentId, expectedReviewHours } = me.verification;
  const nextStep = me.onboarding.nextStep;
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<number>();
  const insets = useSafeAreaInsets();
  const canAddId = governmentId.state === "skipped" || governmentId.state === "failed";
  const { profile } = useMyProfile();
  const sectionsDone = profile?.sectionsDone.length ?? 0;

  // If approved, the session moves the member into the app; otherwise say we looked, so the tap isn't silent.
  async function checkNow() {
    setChecking(true);
    await refresh();
    setChecking(false);
    setCheckedAt(Date.now());
  }

  // Check back regularly and whenever the app returns to the foreground.
  // Approval flips the session to "active" and the root layout moves the member into the app.
  useEffect(() => {
    const interval = setInterval(() => void refresh(), POLL_MS);
    const subscription = AppState.addEventListener("change", (state) => state === "active" && void refresh());
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [refresh]);

  // A failed check sends the member back to retry it.
  useEffect(() => {
    if (nextStep !== "pending" && nextStep !== "done") router.replace(STEP_ROUTES[nextStep]);
  }, [nextStep]);

  return (
    <Screen
      header={
        <View className="gap-3 bg-ivory px-5 pb-2" style={{ paddingTop: insets.top + 16 }}>
          <StepMeta label="Verification phase" right={{ kind: "text", label: "Step 6 of 6" }} />
          <View className="flex-row gap-1.5">
            {Array.from({ length: 6 }, (_, i) => (
              <View key={i} className="h-1 flex-1 rounded-full bg-wine" />
            ))}
          </View>
        </View>
      }
    >
      <View className="items-center gap-3 pt-2">
        <View className="h-24 w-24 items-center justify-center rounded-full bg-sand">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-white">
            <Icon name="shield-check" size={32} color="wine" />
          </View>
          <View className="absolute bottom-2 right-2 h-3 w-3 rounded-full border-2 border-white bg-review" />
        </View>
        <AppText weight="bold" className="text-center text-[24px] leading-8">
          We’re checking your details
        </AppText>
        <AppText tone="muted" className="text-center text-[16px] leading-6">
          You can start browsing as soon as your check passes.
        </AppText>
      </View>

      <View className="gap-3">
        <StatusCard
          icon="face-recognition"
          title="Photo and selfie check"
          subtitle="Reviewed by our team"
          state={liveness.state}
        />
        <StatusCard
          icon="card-account-details-outline"
          title="ID badge"
          subtitle="Government-issued document"
          state={governmentId.state}
          note={canAddId ? "Add it any time to earn your verified badge." : undefined}
        />
      </View>

      <View className="flex-row gap-3 rounded-2xl bg-sand p-4">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-verified-soft">
          <Icon name="clock-outline" size={18} color="verified" />
        </View>
        <View className="flex-1 gap-1">
          <AppText weight="bold" className="text-[15px]">
            Usually done within {expectedReviewHours} hours
          </AppText>
          <AppText tone="muted" className="text-sm leading-5">
            Our human moderation team reviews every submission carefully to ensure discretion, personal safety, and
            authenticity.
          </AppText>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(profile?.publishedAt ? routes.profilePreview : routes.profileIntro)}
        className="flex-row items-center gap-3 rounded-2xl bg-white p-4 active:opacity-80"
      >
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-wine-soft">
          <Icon name="account-edit-outline" size={20} color="wine" />
        </View>
        <View className="flex-1">
          <AppText weight="bold" tone="wine" className="text-[15px]">
            {profile?.publishedAt ? "Your profile is ready" : "Build your profile while you wait"}
          </AppText>
          <AppText weight="semibold" tone="muted" className="text-xs">
            {profile?.publishedAt
              ? "We’ll start introducing you once you’re verified"
              : `${sectionsDone} of 6 sections done · about 5 minutes`}
          </AppText>
        </View>
        <Icon name="arrow-right" size={20} color="wine" />
      </Pressable>

      {canAddId ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(routes.idVerification)}
          className="flex-row items-center gap-3 rounded-2xl bg-sand-dark p-4 active:opacity-80"
        >
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-wine-soft">
            <Icon name="credit-card-plus-outline" size={20} color="wine" />
          </View>
          <View className="flex-1">
            <AppText weight="bold" tone="wine" className="text-[15px]">
              Add my ID while I wait
            </AppText>
            <AppText weight="semibold" tone="muted" className="text-xs">
              Earn your verified badge
            </AppText>
          </View>
          <Icon name="arrow-right" size={20} color="wine" />
        </Pressable>
      ) : null}

      <View className="gap-1">
        {checkedAt && !checking ? (
          <AppText tone="muted" className="text-center text-sm">
            Checked just now — still being reviewed.
          </AppText>
        ) : null}
        <Button
          label={checking ? "Checking…" : "Check now"}
          leadingIcon={checking ? undefined : "refresh"}
          variant="text"
          strong
          disabled={checking}
          onPress={() => void checkNow()}
        />
      </View>
    </Screen>
  );
}
