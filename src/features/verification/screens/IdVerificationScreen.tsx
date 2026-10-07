import type { GovernmentIdDocumentType } from "@contracts";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { useMe, useSession } from "@/features/auth";
import { errorMessage } from "@/shared/lib/apiClient";
import {
  AppText,
  AuthImage,
  Button,
  ErrorBanner,
  Icon,
  OnboardingHeader,
  Screen,
  StepMeta,
  TopBar,
  type IconName,
} from "@/shared/ui";

import { skipGovernmentId, submitGovernmentId } from "../api/verificationApi";
import { onboardingBack, useAdvanceOnboarding } from "../onboardingSteps";

const DOCUMENTS: { type: GovernmentIdDocumentType; label: string; issuer: string; icon: IconName }[] = [
  { type: "nin", label: "NIN slip or card", issuer: "National Identity Management Commission", icon: "card-account-details-outline" },
  { type: "drivers_licence", label: "Driver’s licence", issuer: "Federal Road Safety Corps (FRSC)", icon: "car-outline" },
  { type: "passport", label: "International passport", issuer: "Nigeria Immigration Service (NIS)", icon: "passport" },
  { type: "voters_card", label: "Voter’s card", issuer: "Permanent Voter Card (INEC)", icon: "vote-outline" },
];

function DocumentCard({
  document,
  selected,
  onPress,
}: {
  document: (typeof DOCUMENTS)[number];
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      className={`flex-row items-center gap-3 rounded-2xl p-4 ${selected ? "border border-verified/20 bg-white" : "bg-sand"}`}
    >
      <View className={`h-10 w-10 items-center justify-center rounded-full ${selected ? "bg-verified-soft" : "bg-white"}`}>
        <Icon name={document.icon} size={20} color={selected ? "verified" : "inkMuted"} />
      </View>
      <View className="flex-1">
        <AppText weight="bold" className="text-base">
          {document.label}
        </AppText>
        <AppText weight="semibold" tone="muted" className="text-xs">
          {document.issuer}
        </AppText>
      </View>
      {selected ? <Icon name="check-circle" size={22} color="verified" /> : <View className="h-5 w-5 rounded-full bg-sand-dark" />}
    </Pressable>
  );
}

/** "edit" is the same screen opened from the Me tab: a plain back arrow, and it returns there when done. */
export function IdVerificationScreen({ mode = "onboarding" }: { mode?: "onboarding" | "edit" }) {
  const editing = mode === "edit";
  const me = useMe();
  const { setMe } = useSession();
  const advanceOnboarding = useAdvanceOnboarding();
  const advance: typeof advanceOnboarding = (latest, from) => {
    if (!editing) return advanceOnboarding(latest, from);
    setMe(latest);
    router.back();
  };
  const idState = me.verification.governmentId.state;
  const alreadySent = idState === "pending" || idState === "passed";
  // Only the first skip is recorded; after that (coming back, or from "Add my ID while I wait") just move on.
  const skipRecorded = me.onboarding.nextStep !== "id-verification";
  const [documentType, setDocumentType] = useState<GovernmentIdDocumentType>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const mainPhoto = me.photos[0];

  async function run(action: () => Promise<Parameters<typeof advance>[0]>) {
    setBusy(true);
    setError(undefined);
    try {
      advance(await action(), "id-verification");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      // The screen stays in the back stack after moving on; reset so going back isn't stuck on "Uploading…".
      setBusy(false);
    }
  }

  async function handleCapture() {
    if (!documentType) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    const result = permission.granted
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (result.canceled) return;
    await run(() => submitGovernmentId(documentType, result.assets[0]));
  }

  return (
    <Screen
      header={
        editing ? (
          <TopBar title="Verified badge" onBack={() => router.back()} />
        ) : (
          <OnboardingHeader step={6} onBack={onboardingBack("id-verification")} />
        )
      }
    >
      {editing ? null : <StepMeta label="Verification" right={{ kind: "text", label: "Step 6 of 6" }} />}
      <View className="gap-1.5">
        <AppText weight="bold" className="text-[26px] leading-8">
          Get your verified badge
        </AppText>
        <AppText tone="muted" className="text-[17px] leading-6">
          {editing ? "Optional. Only our review team sees your ID." : "Optional. You can skip this and do it later from your profile."}
        </AppText>
      </View>

      <View className="gap-3 rounded-2xl bg-sand p-4">
        <View className="flex-row items-center justify-between">
          <AppText weight="bold" tone="muted" className="text-[11px] tracking-wider">
            PROFILE CARD PREVIEW
          </AppText>
          <Icon name="shield" size={16} color="verified" />
        </View>
        <View className="flex-row items-center gap-3 rounded-xl bg-white p-3">
          <View className="h-11 w-11 overflow-hidden rounded-full bg-sand">
            {mainPhoto ? <AuthImage path={`/v1/me/photos/${mainPhoto.id}`} className="h-full w-full" /> : null}
          </View>
          <View className="flex-1">
            <AppText weight="bold" className="text-[15px]" numberOfLines={1}>
              {me.user.firstName}
            </AppText>
            <AppText tone="muted" className="text-xs" numberOfLines={1}>
              {me.user.city}
            </AppText>
          </View>
          <View className="flex-row items-center gap-1 rounded-full bg-verified-soft px-2.5 py-1">
            <Icon name="check" size={12} color="verified" />
            <AppText weight="bold" tone="verified" className="text-[11px]">
              ID Verified Member
            </AppText>
          </View>
        </View>
        <AppText tone="muted" className="text-[15px] leading-6">
          Members with an ID check show a verified badge, and others tend to take them more seriously. Only our review
          team sees your ID.
        </AppText>
      </View>

      {alreadySent ? (
        <>
          <View className="flex-row items-center gap-3 rounded-2xl bg-white p-4">
            <Icon name="clock-outline" size={20} color="review" />
            <AppText className="flex-1 text-[15px] leading-5">
              We have your ID and it’s being reviewed. You don’t need to send it again.
            </AppText>
          </View>
          <Button label="Continue" trailingIcon="arrow-right" onPress={() => advance(me, "id-verification")} />
        </>
      ) : (
        <>
          <View className="gap-2">
            <AppText weight="bold" className="text-sm">
              Select valid government ID
            </AppText>
            {DOCUMENTS.map((document) => (
              <DocumentCard
                key={document.type}
                document={document}
                selected={documentType === document.type}
                onPress={() => setDocumentType(document.type)}
              />
            ))}
          </View>

          <View className="flex-row items-center gap-3 rounded-2xl bg-sand p-4">
            <Icon name="lock-outline" size={18} color="verified" />
            <AppText weight="semibold" tone="muted" className="flex-1 text-[13px] leading-5">
              Your credential is fully encrypted. We never share your government ID or documents with other members.
            </AppText>
          </View>

          {error ? <ErrorBanner message={error} /> : null}
          <View className="gap-1">
            <Button
              label={busy ? "Uploading…" : "Take a photo of my ID"}
              leadingIcon={busy ? undefined : "camera-outline"}
              disabled={!documentType || busy}
              onPress={handleCapture}
            />
            {editing ? null : (
              <Button
                label="Skip for now"
                variant="text"
                disabled={busy}
                onPress={() => (skipRecorded ? advance(me, "id-verification") : run(skipGovernmentId))}
              />
            )}
          </View>
        </>
      )}
    </Screen>
  );
}
