import { PROFILE_SECTIONS, type ProfileSection } from "@contracts";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { routes } from "@/shared/navigation/routes";
import { AppText, Button, ErrorBanner, Icon, Screen, TopBar } from "@/shared/ui";

import { FootNote, MyAvatar } from "../components/ProfileParts";
import { useMyProfile } from "../hooks/useMyProfile";
import { SECTION_INFO } from "../sections";

type RowState = "done" | "next" | "locked";

function SectionRow({ section, number, state }: { section: ProfileSection; number: number; state: RowState }) {
  const info = SECTION_INFO[section];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: state === "locked" }}
      disabled={state === "locked"}
      onPress={() => router.push(routes.profileSection(section))}
      className="flex-row items-center gap-3 rounded-2xl bg-white p-3.5 active:bg-sand"
    >
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-sand">
        <Icon name={info.icon} size={20} color={state === "next" ? "wine" : "inkMuted"} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <AppText weight="semibold" className="text-[15px]">
            {number}. {info.title}
          </AppText>
          {state === "next" ? (
            <View className="rounded-md bg-wine-soft px-1.5 py-0.5">
              <AppText weight="bold" tone="wine" className="text-[10px]">
                Start Here
              </AppText>
            </View>
          ) : null}
        </View>
        <AppText tone="muted" className="text-sm" numberOfLines={1}>
          {info.blurb}
        </AppText>
      </View>
      <View
        className={`h-7 w-7 items-center justify-center rounded-full ${
          state === "done" ? "bg-verified-soft" : state === "next" ? "bg-wine-soft" : "bg-sand"
        }`}
      >
        <Icon
          name={state === "done" ? "check" : state === "next" ? "play" : "lock-outline"}
          size={14}
          color={state === "done" ? "verified" : state === "next" ? "wine" : "inkFaint"}
        />
      </View>
    </Pressable>
  );
}

export function ProfileIntroScreen() {
  const { profile, error } = useMyProfile();
  const done = profile?.sectionsDone ?? [];
  const next = PROFILE_SECTIONS.find((section) => !done.includes(section));

  return (
    <Screen
      header={<TopBar onBack={router.canGoBack() ? () => router.back() : undefined} right={<MyAvatar />} />}
    >
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-row items-center gap-1.5 rounded-full bg-sand px-3 py-1.5">
          <View className="h-1.5 w-1.5 rounded-full bg-wine" />
          <AppText weight="bold" tone="muted" className="text-[11px] tracking-wider">
            PROFILE SETUP • STEP BY STEP
          </AppText>
        </View>
        <View className="flex-row items-center gap-1 rounded-full bg-verified-soft px-3 py-1.5">
          <Icon name="shield-check" size={12} color="verified" />
          <AppText weight="bold" tone="verified" className="text-[11px] tracking-wider">
            VETTED CIRCLE
          </AppText>
        </View>
      </View>

      <View className="gap-1.5">
        <AppText weight="bold" className="text-[26px] leading-8">
          Let’s build your profile
        </AppText>
        <AppText tone="muted" className="text-[17px] leading-6">
          Six short sections, about 5 minutes. You can change any answer later.
        </AppText>
      </View>

      <LinearGradient
        colors={["#4A3A34", "#2B2522"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 16, height: 120, padding: 16, justifyContent: "flex-end" }}
      >
        <View className="flex-row items-end justify-between gap-3">
          <View className="flex-1">
            <AppText weight="bold" className="text-[11px] tracking-wider" style={{ color: "#F0A9B1" }}>
              DISCREET ONBOARDING
            </AppText>
            <AppText weight="bold" tone="white" className="text-lg">
              Intentional Introductions
            </AppText>
          </View>
          <View className="flex-row items-center gap-1 rounded-full bg-white/20 px-2.5 py-1">
            <Icon name="clock-outline" size={12} color="white" />
            <AppText weight="bold" tone="white" className="text-xs">
              ~5 Mins
            </AppText>
          </View>
        </View>
      </LinearGradient>

      {error && !profile ? <ErrorBanner message={error} /> : null}
      <View className="gap-2.5">
        {PROFILE_SECTIONS.map((section, index) => (
          <SectionRow
            key={section}
            section={section}
            number={index + 1}
            state={done.includes(section) ? "done" : section === next ? "next" : "locked"}
          />
        ))}
      </View>

      <View className="flex-row gap-3 rounded-2xl bg-sand p-4">
        <View className="h-7 w-7 items-center justify-center rounded-full bg-verified-soft">
          <Icon name="check-circle-outline" size={16} color="verified" />
        </View>
        <View className="flex-1 gap-1">
          <AppText weight="bold" className="text-[15px]">
            Why this matters
          </AppText>
          <AppText tone="muted" className="text-[15px] leading-6">
            Complete profiles are the ones we introduce. Members here want to know these things before a first date.
          </AppText>
        </View>
      </View>

      <View className="gap-3">
        <FootNote icon="shield-outline">Your answers are shown only to verified members</FootNote>
        <Button
          label={!profile ? "Loading…" : next ? (done.length ? "Continue" : "Start") : "Preview my profile"}
          trailingIcon="arrow-right"
          disabled={!profile}
          onPress={() => router.push(next ? routes.profileSection(next) : routes.profilePreview)}
        />
      </View>
    </Screen>
  );
}
