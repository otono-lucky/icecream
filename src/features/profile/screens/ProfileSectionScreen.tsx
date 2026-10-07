import { PROFILE_SECTIONS, type MyProfile, type ProfileSection } from "@contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { useMe, useSession } from "@/features/auth";
import { errorMessage } from "@/shared/lib/apiClient";
import { routes } from "@/shared/navigation/routes";
import { AppText, Button, ErrorBanner, Icon, Screen, StepMeta, TopBar } from "@/shared/ui";

import { saveSection } from "../api/profileApi";
import { FootNote, MyAvatar } from "../components/ProfileParts";
import { useMyProfile } from "../hooks/useMyProfile";
import { isSection, SECTION_INFO, sectionNumber } from "../sections";
import { SectionForm, sectionBody, type Draft } from "../sections/SectionForm";

const back = (fallback: string) => (router.canGoBack() ? router.back() : router.replace(fallback));

export function ProfileSectionScreen() {
  const params = useLocalSearchParams<{ section: string; mode?: string }>();
  const { profile, error } = useMyProfile();
  const mode = params.mode === "edit" ? "edit" : "build";

  if (!isSection(params.section)) return <Screen title="This section doesn’t exist." />;
  if (!profile) {
    return <Screen header={<TopBar onBack={() => back(routes.profileIntro)} />}>{error ? <ErrorBanner message={error} /> : null}</Screen>;
  }
  // Keyed so moving between sections starts each one from its saved answers.
  return <SectionEditor key={params.section} section={params.section} mode={mode} profile={profile} />;
}

function SectionEditor({ section, mode, profile }: { section: ProfileSection; mode: "build" | "edit"; profile: MyProfile }) {
  const me = useMe();
  const { refresh } = useSession();
  const { save } = useMyProfile();
  const [draft, setDraft] = useState<Draft>({ ...profile.answers, city: me.user.city ?? "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const number = sectionNumber(section);
  const body = sectionBody(section, draft);
  const last = number === PROFILE_SECTIONS.length;

  async function handleSave() {
    if (!body) return;
    setSaving(true);
    setError(undefined);
    try {
      save(await saveSection(section, body));
      if (section === "location" && draft.city !== me.user.city) await refresh();
      if (mode === "edit") back(routes.me);
      else router.push(last ? routes.profilePreview : routes.profileSection(PROFILE_SECTIONS[number]));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const label = saving ? "Saving…" : mode === "edit" ? "Save changes" : last ? "Preview my profile" : "Continue";

  if (mode === "edit") {
    return (
      <Screen header={<TopBar title="Edit section" onBack={() => back(routes.me)} right={<MyAvatar />} />}>
        <View className="flex-row items-center gap-2.5 rounded-xl bg-sand px-3.5 py-3">
          <Icon name="alert-circle" size={16} color="wine" />
          <AppText weight="semibold" className="flex-1 text-[13px] leading-[18px]">
            Your changes will be updated on your profile immediately.
          </AppText>
        </View>
        <SectionForm section={section} draft={draft} set={set} mode="edit" />
        <View className="flex-row items-center gap-2 self-start rounded-full bg-sand px-4 py-2.5">
          <Icon name="lock-outline" size={14} color="inkMuted" />
          <AppText weight="bold" tone="muted" className="text-[11px] tracking-wider">
            SHOWN ONLY TO VERIFIED MEMBERS.
          </AppText>
        </View>
        {error ? <ErrorBanner message={error} /> : null}
        <View className="gap-1">
          <Button label={label} leadingIcon={saving ? undefined : "check"} disabled={!body || saving} onPress={() => void handleSave()} />
          <Button label="Cancel" variant="text" onPress={() => back(routes.me)} />
        </View>
      </Screen>
    );
  }

  const percent = Math.floor((number / PROFILE_SECTIONS.length) * 100);
  return (
    <Screen
      header={
        <TopBar onBack={() => back(routes.profileIntro)} right={<MyAvatar />}>
          <View
            className="flex-row gap-1.5"
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: PROFILE_SECTIONS.length, now: number }}
          >
            {PROFILE_SECTIONS.map((key, index) => (
              <View key={key} className={`h-1 flex-1 rounded-full ${index < number ? "bg-wine" : "bg-sand-dark"}`} />
            ))}
          </View>
        </TopBar>
      }
    >
      <StepMeta
        label={`Section ${number} of ${PROFILE_SECTIONS.length} • ${SECTION_INFO[section].theme}`}
        right={
          number === 1
            ? undefined
            : section === "work"
              ? { kind: "mark", label: "Dignified Match", icon: "check-decagram" }
              : { kind: "text", label: last ? "100%" : `${percent}% Completed` }
        }
      />
      <SectionForm section={section} draft={draft} set={set} mode="build" />
      {error ? <ErrorBanner message={error} /> : null}
      <View className="gap-3 pt-1">
        <View className="flex-row gap-3">
          {section === "location" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous section"
              onPress={() => back(routes.profileIntro)}
              className="h-[52px] w-[52px] items-center justify-center rounded-xl bg-sand active:bg-sand-dark"
            >
              <Icon name="arrow-left" size={20} />
            </Pressable>
          ) : null}
          <View className="flex-1">
            <Button label={label} trailingIcon={saving ? undefined : "arrow-right"} disabled={!body || saving} onPress={() => void handleSave()} />
          </View>
        </View>
        {section === "marital-history" ? (
          <AppText weight="semibold" tone="muted" className="text-center text-xs">
            Step 1 of 6 • Takes under 3 minutes
          </AppText>
        ) : section === "faith" ? (
          <FootNote>Shown only to verified members</FootNote>
        ) : section === "work" ? (
          <FootNote>Saved when you continue</FootNote>
        ) : null}
      </View>
    </Screen>
  );
}
