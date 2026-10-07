import type { Gender } from "@contracts";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { useMe } from "@/features/auth";
import { errorMessage } from "@/shared/lib/apiClient";
import {
  AppText,
  Button,
  colors,
  ErrorBanner,
  Icon,
  noWebFocusRing,
  OnboardingHeader,
  Screen,
  StepMeta,
  type IconName,
} from "@/shared/ui";

import { setBasicDetails } from "../api/verificationApi";
import { CityPicker } from "../components/CityPicker";
import { onboardingBack, useAdvanceOnboarding } from "../onboardingSteps";

function GenderCard({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: IconName;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      className={`min-h-[60px] flex-1 flex-row items-center gap-3 rounded-2xl px-4 ${
        selected ? "border border-wine/20 bg-wine-soft" : "bg-white"
      }`}
    >
      <View className={`h-8 w-8 items-center justify-center rounded-full ${selected ? "bg-white" : "bg-sand"}`}>
        <Icon name={icon} size={18} color={selected ? "wine" : "inkMuted"} />
      </View>
      <AppText weight="bold" tone={selected ? "wine" : "ink"} className="flex-1 text-base">
        {label}
      </AppText>
      {selected ? (
        <Icon name="check-circle" size={22} color="wine" />
      ) : (
        <View className="h-5 w-5 rounded-full bg-sand-dark" />
      )}
    </Pressable>
  );
}

export function BasicDetailsScreen() {
  const { user } = useMe();
  const advance = useAdvanceOnboarding();
  const [firstName, setFirstName] = useState(user.firstName ?? "");
  const [gender, setGender] = useState<Gender | undefined>(user.gender ?? undefined);
  const [city, setCity] = useState(user.city ?? "");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const nameOk = firstName.trim().length > 0;

  async function handleContinue() {
    if (!gender) return;
    setSaving(true);
    setError(undefined);
    try {
      advance(await setBasicDetails({ firstName: firstName.trim(), gender, city: city.trim() }), "basic-details");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      // The screen stays in the back stack after moving on; reset so going back isn't stuck on "Saving…".
      setSaving(false);
    }
  }

  return (
    <Screen header={<OnboardingHeader step={3} onBack={onboardingBack("basic-details")} />}>
      <StepMeta label="Step 3 of 6" right={{ kind: "mark", label: "Private & Verified" }} />
      <View className="gap-1.5">
        <AppText weight="bold" className="text-[26px] leading-8">
          About you
        </AppText>
        <AppText tone="muted" className="text-[17px] leading-6">
          Tell us the basics so we can introduce you properly to verified members.
        </AppText>
      </View>

      <View className="flex-row items-center gap-3 rounded-2xl bg-sand p-3">
        <View className="flex-row">
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              className="h-9 w-9 items-center justify-center rounded-full border-2 border-sand bg-white"
              style={{ marginLeft: i === 0 ? 0 : -10 }}
            >
              <Icon name="account" size={18} color={i === 1 ? "wine" : "inkMuted"} />
            </View>
          ))}
        </View>
        <View className="flex-1">
          <AppText weight="bold" className="text-[13px]" numberOfLines={1}>
            Join a community of verified members
          </AppText>
          <AppText weight="semibold" tone="muted" className="text-xs" numberOfLines={1}>
            Profiles are discreet and screened
          </AppText>
        </View>
      </View>

      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <AppText weight="bold" className="text-sm">
            First name
          </AppText>
          <AppText tone="muted" className="text-xs">
            Legal or preferred
          </AppText>
        </View>
        <View className="min-h-[56px] flex-row items-center rounded-xl border border-sand-dark bg-white pr-4">
          <TextInput
            accessibilityLabel="First name"
            value={firstName}
            onChangeText={setFirstName}
            autoComplete="given-name"
            maxLength={50}
            placeholderTextColor={colors.inkFaint}
            className="flex-1 px-4 py-3 font-body text-lg text-ink"
            style={noWebFocusRing}
          />
          {nameOk ? <Icon name="check-circle" size={22} color="verified" /> : null}
        </View>
        <AppText weight="semibold" tone="muted" className="text-xs">
          Displayed on your profile to curated matches.
        </AppText>
      </View>

      <View className="gap-2">
        <AppText weight="bold" className="text-sm">
          I am a
        </AppText>
        <View className="flex-row gap-3">
          <GenderCard label="Woman" icon="gender-female" selected={gender === "woman"} onPress={() => setGender("woman")} />
          <GenderCard label="Man" icon="gender-male" selected={gender === "man"} onPress={() => setGender("man")} />
        </View>
      </View>

      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <AppText weight="bold" className="text-sm">
            City
          </AppText>
          <View className="flex-row items-center gap-1">
            <Icon name="crosshairs-gps" size={13} color="verified" />
            <AppText weight="semibold" tone="verified" className="text-xs">
              Nigeria
            </AppText>
          </View>
        </View>
        <CityPicker value={city} onChange={setCity} />
      </View>

      <View className="flex-row gap-3 rounded-2xl bg-sand p-4">
        <Icon name="lock-outline" size={18} color="verified" />
        <AppText weight="semibold" tone="muted" className="flex-1 text-[13px] leading-5">
          Your street address is never requested or shared. We only use your city to suggest people near you.
        </AppText>
      </View>

      {error ? <ErrorBanner message={error} /> : null}
      <View className="gap-2 pt-1">
        <Button
          label={saving ? "Saving…" : "Continue"}
          trailingIcon={saving ? undefined : "arrow-right"}
          disabled={!nameOk || !gender || !city.trim() || saving}
          onPress={handleContinue}
        />
        <AppText weight="semibold" tone="muted" className="text-center text-xs">
          Next: Add your photos
        </AppText>
      </View>
    </Screen>
  );
}
