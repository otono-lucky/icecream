import { ageOn, MAX_PHOTOS, PROFILE_SECTIONS, todayUtc } from "@contracts";
import { router } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";

import { useMe } from "@/features/auth";
import { myPhotoPath } from "@/shared/lib/apiPaths";
import { routes } from "@/shared/navigation/routes";
import { AppText, AuthImage, ErrorBanner, Icon, Screen, TopBar, type IconName } from "@/shared/ui";

import { MyAvatar, VerifiedBadge } from "../components/ProfileParts";
import { sectionSummary } from "../format";
import { useMyProfile } from "../hooks/useMyProfile";
import { SECTION_INFO } from "../sections";

function LinkRow({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl bg-white p-3.5 active:bg-sand"
    >
      <View className="h-9 w-9 items-center justify-center rounded-lg bg-sand">
        <Icon name={icon} size={18} color="wine" />
      </View>
      <AppText weight="semibold" className="flex-1 text-[15px]">
        {label}
      </AppText>
      <Icon name="chevron-right" size={20} color="inkMuted" />
    </Pressable>
  );
}

/** The Me tab: your photos, profile answers and verification, each with a way to change it. */
export function MyProfileScreen() {
  const { user, photos, verification } = useMe();
  const { profile, error } = useMyProfile();
  const age = user.dateOfBirth ? ageOn(user.dateOfBirth, todayUtc()) : null;
  const done = profile?.sectionsDone.length ?? 0;
  const total = PROFILE_SECTIONS.length;
  const remaining = total - done;
  const published = Boolean(profile?.publishedAt);
  const idState = verification.governmentId.state;

  return (
    <Screen header={<TopBar title="Me" right={<MyAvatar />} />}>
      <View className="flex-row items-center gap-4 rounded-2xl bg-white p-4">
        <MyAvatar size={64} />
        <View className="flex-1 gap-1">
          <AppText weight="bold" className="text-[22px] leading-7">
            {user.firstName}
            {age ? `, ${age}` : ""}
          </AppText>
          <View className="flex-row items-center gap-1">
            <Icon name="map-marker-outline" size={15} color="inkMuted" />
            <AppText tone="muted" className="text-[15px]">
              {user.city}
            </AppText>
          </View>
          <View className="flex-row flex-wrap gap-1.5 pt-0.5">
            {verification.liveness.state === "passed" ? <VerifiedBadge label="PHOTO VERIFIED" /> : null}
            {idState === "passed" ? <VerifiedBadge label="ID VERIFIED" /> : null}
          </View>
        </View>
      </View>

      {profile ? (
        <View className="gap-3 rounded-2xl bg-white p-4">
          <View className="flex-row items-center gap-2">
            <Icon name="chart-box-outline" size={18} color="wine" />
            <AppText weight="bold" className="flex-1 text-[15px]">
              Profile Strength
            </AppText>
            <AppText weight="bold" tone="wine" className="text-[13px]">
              {done} of {total} Complete
            </AppText>
          </View>
          <View className="flex-row gap-1.5">
            {PROFILE_SECTIONS.map((section, index) => (
              <View key={section} className={`h-1.5 flex-1 rounded-full ${index < done ? "bg-wine" : "bg-sand-dark"}`} />
            ))}
          </View>
          {!published ? (
            <View className="flex-row items-center gap-3">
              <AppText tone="muted" className="flex-1 text-[13px] leading-[18px]">
                {remaining
                  ? `Complete ${remaining} remaining ${remaining === 1 ? "section" : "sections"} to start being introduced.`
                  : "All done. Publish your profile to start being introduced."}
              </AppText>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(remaining ? routes.profileIntro : routes.profilePreview)}
                className="rounded-lg bg-wine px-3 py-2 active:bg-wine-dark"
              >
                <AppText weight="bold" tone="white" className="text-[13px]">
                  {remaining ? "Finish Profile" : "Review & publish"}
                </AppText>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : error ? (
        <ErrorBanner message={error} />
      ) : null}

      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <AppText weight="bold" className="text-lg">
            Your Photos ({photos.length} of {MAX_PHOTOS})
          </AppText>
          <Pressable accessibilityRole="button" hitSlop={10} onPress={() => router.push(routes.editPhotos)}>
            <AppText weight="semibold" tone="wine" className="text-sm">
              Edit Photos
            </AppText>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2.5">
          {photos.map((photo) => (
            <View key={photo.id} className="h-28 w-24 overflow-hidden rounded-xl bg-sand">
              <AuthImage path={myPhotoPath(photo.id)} style={{ width: 96, height: 112 }} />
            </View>
          ))}
          {photos.length < MAX_PHOTOS ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add photo"
              onPress={() => router.push(routes.editPhotos)}
              className="h-28 w-24 items-center justify-center gap-1 rounded-xl bg-sand active:bg-sand-dark"
            >
              <Icon name="image-plus" size={22} color="inkMuted" />
              <AppText weight="semibold" tone="muted" className="text-xs">
                Add Photo
              </AppText>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>

      {idState !== "passed" ? (
        <View className="gap-3 rounded-2xl bg-sand-dark p-4">
          <View className="flex-row gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-wine-soft">
              <Icon name="shield-check-outline" size={18} color="wine" />
            </View>
            <View className="flex-1 gap-0.5">
              <AppText weight="bold" className="text-[15px]">
                {idState === "pending" ? "Your ID is being reviewed" : "Verify Government Identity"}
              </AppText>
              <AppText tone="muted" className="text-[13px] leading-[18px]">
                {idState === "pending"
                  ? "We’ll add the ID verified badge to your profile once it’s checked."
                  : "Earn the ID verified badge, so members know you are who you say you are."}
              </AppText>
            </View>
          </View>
          {idState !== "pending" ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(routes.addId)}
              className="min-h-[44px] flex-row items-center justify-center gap-2 rounded-xl bg-white active:bg-sand"
            >
              <Icon name="card-account-details-outline" size={18} color="wine" />
              <AppText weight="bold" tone="wine" className="text-sm">
                Add Government ID
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {profile ? (
        <View className="gap-3">
          <AppText weight="bold" className="text-lg">
            Profile Details
          </AppText>
          {PROFILE_SECTIONS.map((section) => {
            const summary = sectionSummary(section, profile.answers, user.city);
            return (
              <View key={section} className="flex-row gap-3 rounded-2xl bg-white p-4">
                <View className="flex-1 gap-1">
                  <AppText weight="bold" tone="muted" className="text-[11px] tracking-wider">
                    {SECTION_INFO[section].detailsLabel.toUpperCase()}
                  </AppText>
                  <AppText tone={summary ? "ink" : "faint"} className="text-[15px] leading-[22px]" numberOfLines={3}>
                    {summary ?? "Not answered yet"}
                  </AppText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${SECTION_INFO[section].title}`}
                  hitSlop={10}
                  onPress={() => router.push(routes.editProfile(section))}
                >
                  <AppText weight="semibold" tone="wine" className="text-sm">
                    {summary ? "Edit" : "Add"}
                  </AppText>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      <View className="gap-2.5">
        <LinkRow icon="eye-outline" label="Preview My Profile" onPress={() => router.push(routes.profilePreview)} />
        <LinkRow icon="shield-outline" label="Account Settings & Privacy" onPress={() => router.push(routes.settings)} />
      </View>
    </Screen>
  );
}
