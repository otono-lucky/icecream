import { ageOn, MIN_AGE, todayUtc } from "@contracts";
import { useState } from "react";
import { View } from "react-native";

import { useMe } from "@/features/auth";
import { errorMessage } from "@/shared/lib/apiClient";
import { AppText, Button, ErrorBanner, Icon, OnboardingHeader, Screen, StepLabel, type IconName } from "@/shared/ui";

import { setDateOfBirth } from "../api/verificationApi";
import { DateWheel, toIsoDate, type DateParts } from "../components/DateWheel";
import { onboardingBack, useAdvanceOnboarding } from "../onboardingSteps";

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 83 }, (_, i) => THIS_YEAR - 100 + i); // ages 18–100

function InfoTile({ icon, tone, title, body }: { icon: IconName; tone: "verified" | "wine"; title: string; body: string }) {
  return (
    <View className="flex-1 gap-1.5 rounded-xl bg-sand p-3">
      <View className="flex-row items-center gap-1.5">
        <Icon name={icon} size={14} color={tone} />
        <AppText weight="bold" tone={tone} className="text-xs tracking-wider">
          {title}
        </AppText>
      </View>
      <AppText weight="semibold" className="text-xs leading-4">
        {body}
      </AppText>
    </View>
  );
}

function toParts(iso: string): DateParts {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

export function AgeGateScreen() {
  const me = useMe();
  const advance = useAdvanceOnboarding();
  // Already saved (the member came back to this step): show it locked; it can't be changed.
  const saved = me.user.dateOfBirth;
  const [date, setDate] = useState<DateParts>(saved ? toParts(saved) : { year: THIS_YEAR - 45, month: 1, day: 1 });
  // The wheel always shows a date; don't let a member lock in the default by accident.
  const [touched, setTouched] = useState(Boolean(saved));
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const iso = toIsoDate(date);
  const age = ageOn(iso, todayUtc());
  const eligible = age >= MIN_AGE;

  async function handleContinue() {
    if (saved) {
      // Came back to a finished step: go forward one screen, as the member went back one.
      advance(me, "age-gate");
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      advance(await setDateOfBirth(iso), "age-gate");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      // The screen stays in the back stack after moving on; reset so going back isn't stuck on "Saving…".
      setSaving(false);
    }
  }

  return (
    <Screen header={<OnboardingHeader step={2} onBack={onboardingBack("age-gate")} />}>
      <StepLabel step={2} label="Identity & maturity" variant="plain" />
      <View className="gap-1.5">
        <AppText weight="bold" className="text-[26px] leading-8">
          Your date of birth
        </AppText>
        <AppText tone="muted" className="text-[17px] leading-6">
          Members are {MIN_AGE} and over. Your age shows on your profile, never your birthday.
        </AppText>
      </View>

      <DateWheel
        value={date}
        years={YEARS}
        locked={Boolean(saved)}
        onChange={(next) => {
          setTouched(true);
          setDate(next);
        }}
      />

      {touched ? (
        <View className={`flex-row items-center gap-3 rounded-xl p-3 ${eligible ? "bg-verified-soft" : "bg-sand"}`}>
          <View className={`h-9 w-9 items-center justify-center rounded-full ${eligible ? "bg-verified" : "bg-ink-faint"}`}>
            <Icon name={eligible ? "check-bold" : "calendar-blank-outline"} size={18} color="white" />
          </View>
          <View className="flex-1">
            <AppText weight="bold" tone={eligible ? "verified" : "ink"} className="text-base">
              Age: {age} years old
            </AppText>
            <AppText weight="semibold" tone={eligible ? "verified" : "muted"} className="text-xs">
              {eligible ? `Meets community standard (${MIN_AGE}+)` : `Members are ${MIN_AGE} and over`}
            </AppText>
          </View>
        </View>
      ) : null}

      <View className="flex-row items-center gap-2">
        <Icon name="lock-outline" size={16} color="inkMuted" />
        <AppText className="flex-1 text-[15px]">
          {saved ? "Saved. Your date of birth can’t be changed." : "Please check it carefully. It can’t be changed later."}
        </AppText>
      </View>

      <View className="flex-row gap-3">
        <InfoTile icon="shield-outline" tone="verified" title="DISCRETION" body="Zero public birthdays visible on your dossier card." />
        <InfoTile icon="timer-sand" tone="wine" title="ELIGIBILITY" body="Curated strictly for refined cohorts 35 and older." />
      </View>

      {error ? <ErrorBanner message={error} /> : null}
      <Button
        label={saving ? "Saving…" : touched ? "Continue" : "Choose your date of birth"}
        trailingIcon={touched && !saving ? "arrow-right" : undefined}
        disabled={!touched || saving}
        onPress={handleContinue}
      />
    </Screen>
  );
}
