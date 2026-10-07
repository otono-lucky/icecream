import { ageOn, LABELS, PROFILE_SECTIONS, todayUtc, type ProfileSection } from "@contracts";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMe, useSession } from "@/features/auth";
import { errorMessage } from "@/shared/lib/apiClient";
import { myPhotoPath } from "@/shared/lib/apiPaths";
import { routes } from "@/shared/navigation/routes";
import { AppText, Button, ErrorBanner, Icon, PhotoCarousel, TopBar } from "@/shared/ui";

import { publishProfile } from "../api/profileApi";
import { FootNote, VerifiedBadge } from "../components/ProfileParts";
import { profileFacts, sectionSummary } from "../format";
import { useMyProfile } from "../hooks/useMyProfile";
import { SECTION_INFO } from "../sections";

const PREVIEW_TITLES: Partial<Record<ProfileSection, string>> = { "looking-for": "What I’m looking for" };

function SectionCard({ section, summary, quote }: { section: ProfileSection; summary: string | null; quote?: { label: string; words: string | null } }) {
  const info = SECTION_INFO[section];
  return (
    <View className="gap-2 rounded-2xl bg-white p-4">
      <View className="flex-row items-center gap-2">
        <Icon name={info.icon} size={18} color="wine" />
        <AppText weight="bold" className="flex-1 text-[15px]">
          {PREVIEW_TITLES[section] ?? info.title}
        </AppText>
        <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${info.title}`} hitSlop={10} onPress={() => router.push(routes.editProfile(section))}>
          <AppText weight="semibold" tone="wine" className="text-sm">
            {summary ? "Edit" : "Add"}
          </AppText>
        </Pressable>
      </View>
      {quote ? (
        <View className="gap-1 pl-7">
          <AppText weight="bold" tone="wine" className="text-[13px]">
            {quote.label}
          </AppText>
          {quote.words ? (
            <AppText className="text-[15px] italic leading-6">“{quote.words}”</AppText>
          ) : null}
        </View>
      ) : (
        <AppText tone={summary ? "ink" : "faint"} className="pl-7 text-[15px] leading-6">
          {summary ?? "Not answered yet"}
        </AppText>
      )}
    </View>
  );
}

export function ProfilePreviewScreen() {
  const me = useMe();
  const { status } = useSession();
  const { profile, error: loadError, save } = useMyProfile();
  const insets = useSafeAreaInsets();
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string>();
  const { user, photos, verification } = me;
  const age = user.dateOfBirth ? ageOn(user.dateOfBirth, todayUtc()) : null;
  const answers = profile?.answers;
  const complete = profile?.sectionsDone.length === PROFILE_SECTIONS.length;
  const published = Boolean(profile?.publishedAt);

  async function handlePublish() {
    setPublishing(true);
    setError(undefined);
    try {
      save(await publishProfile());
      // Back to where the member started: the pending screen while still being verified, otherwise Today.
      router.dismissTo(status === "onboarding" ? routes.verificationPending : routes.home);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <View className="flex-1 bg-ivory">
      <TopBar title="This is how others will see you" onBack={() => router.back()} />
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-5 pb-6 pt-2">
        <View className="flex-row gap-3 rounded-2xl bg-sand p-4">
          <Icon name="shield-check-outline" size={18} color="verified" />
          <AppText tone="muted" className="flex-1 text-[15px] leading-[22px]">
            {published
              ? "This is your profile as verified members see it. Tap “Edit” on any section to change it."
              : "Review your details. You can tap “Edit” on any section at any time before publishing."}
          </AppText>
        </View>

        <View className="overflow-hidden rounded-2xl bg-white">
          <View className="h-[380px]">
            <PhotoCarousel paths={photos.map((photo) => myPhotoPath(photo.id))}>
              <LinearGradient
                pointerEvents="none"
                colors={["transparent", "rgba(0,0,0,0.7)"]}
                locations={[0.55, 1]}
                style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
              />
              <View pointerEvents="none" className="absolute bottom-0 left-0 right-0 gap-1.5 p-4">
                <View className="flex-row flex-wrap gap-1.5">
                  {verification.liveness.state === "passed" ? <VerifiedBadge label="PHOTO VERIFIED" /> : null}
                  {verification.governmentId.state === "passed" ? <VerifiedBadge label="ID VERIFIED" /> : null}
                </View>
                <AppText weight="bold" tone="white" className="text-[26px] leading-8">
                  {user.firstName}
                  {age ? `, ${age}` : ""}
                </AppText>
                <View className="flex-row items-center gap-1">
                  <Icon name="map-marker-outline" size={15} color="white" />
                  <AppText weight="medium" tone="white" className="text-[15px]">
                    {user.city}
                  </AppText>
                </View>
              </View>
            </PhotoCarousel>
          </View>
          {answers ? (
            <View className="flex-row flex-wrap gap-2 p-4">
              {profileFacts(answers, "me").map((fact) => (
                <View key={fact.label} className="rounded-full bg-sand px-3 py-1.5">
                  <AppText weight="semibold" className="text-[13px]">
                    {fact.label}
                  </AppText>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {loadError && !answers ? <ErrorBanner message={loadError} /> : null}
        {answers
          ? PROFILE_SECTIONS.map((section) => (
              <SectionCard
                key={section}
                section={section}
                summary={section === "work" && answers.occupation
                  ? [answers.occupation, answers.typicalWeek].filter(Boolean).join(". ")
                  : sectionSummary(section, answers, user.city)}
                quote={
                  section === "looking-for" && answers.lookingFor
                    ? { label: LABELS.lookingFor[answers.lookingFor], words: answers.ownWords }
                    : undefined
                }
              />
            ))
          : null}

        <FootNote>Private and member-screened community</FootNote>
      </ScrollView>

      <View className="gap-1 border-t border-sand-dark bg-ivory px-5 pt-3" style={{ paddingBottom: insets.bottom + 8 }}>
        {error ? <ErrorBanner message={error} /> : null}
        {published ? (
          <Button label="Done" onPress={() => router.back()} />
        ) : (
          <>
            <Button
              label={publishing ? "Publishing…" : complete || !profile ? "Publish my profile" : "Finish every section to publish"}
              trailingIcon={publishing || !complete ? undefined : "arrow-right"}
              disabled={!complete || publishing}
              onPress={() => void handlePublish()}
            />
            <Button label="Make changes" variant="text" strong onPress={() => router.back()} />
          </>
        )}
      </View>
    </View>
  );
}
