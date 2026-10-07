import { MAX_PHOTOS, MIN_PHOTOS, type Me } from "@contracts";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { Image, Pressable, View, type LayoutChangeEvent } from "react-native";

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

import { deletePhoto, reorderPhotos, replacePhoto, uploadPhoto } from "../api/verificationApi";
import { onboardingBack, useAdvanceOnboarding } from "../onboardingSteps";

const COLUMNS = 3;
const GAP = 10;
const GUIDELINES = ["Face clearly visible", "Just you, no group photos", "Taken in the last 2 years"];

function PhotoAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-[44px] flex-row items-center gap-1.5 rounded-full bg-sand px-4 active:bg-sand-dark"
    >
      <Icon name={icon} size={16} color="wine" />
      <AppText weight="semibold" className="text-sm">
        {label}
      </AppText>
    </Pressable>
  );
}

/** Moves one id in the list: -1 earlier, +1 later, or "front" to make it the main photo. */
function moved(ids: string[], id: string, to: -1 | 1 | "front"): string[] {
  const from = ids.indexOf(id);
  const next = ids.filter((other) => other !== id);
  next.splice(to === "front" ? 0 : Math.max(0, Math.min(ids.length - 1, from + to)), 0, id);
  return next;
}

/** "edit" is the same screen opened from the Me tab: a plain back arrow, and Done instead of Continue. */
export function PhotosScreen({ mode = "onboarding" }: { mode?: "onboarding" | "edit" }) {
  const editing = mode === "edit";
  const me = useMe();
  const { setMe } = useSession();
  const advance = useAdvanceOnboarding();
  // Photos added on this device show instantly from the local file; the rest load from the server.
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [gridWidth, setGridWidth] = useState(0);
  const count = me.photos.length;
  const remaining = MAX_PHOTOS - count;
  const ids = me.photos.map((photo) => photo.id);
  const selectedIndex = selectedId ? ids.indexOf(selectedId) : -1;
  const tile = gridWidth ? (gridWidth - GAP * (COLUMNS - 1)) / COLUMNS : 0;

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError(undefined);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(undefined);
    }
  }

  const pickImages = (limit: number) =>
    ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: limit > 1,
      selectionLimit: limit,
      quality: 0.8,
    });

  async function handleAdd() {
    if (busy || remaining <= 0) return;
    setError(undefined);
    const result = await pickImages(remaining);
    if (result.canceled) return;
    await run("Uploading…", async () => {
      let latest: Me = me;
      for (const asset of result.assets.slice(0, remaining)) {
        const known = new Set(latest.photos.map((photo) => photo.id));
        latest = await uploadPhoto(asset);
        const added = latest.photos.find((photo) => !known.has(photo.id));
        if (added) setPreviews((current) => ({ ...current, [added.id]: asset.uri }));
        setMe(latest);
      }
    });
  }

  async function handleReplace(photoId: string) {
    setError(undefined);
    const result = await pickImages(1);
    if (result.canceled) return;
    await run("Replacing…", async () => {
      const latest = await replacePhoto(photoId, result.assets[0]);
      const replacement = latest.photos.find((photo) => !ids.includes(photo.id));
      if (replacement) {
        setPreviews((current) => ({ ...current, [replacement.id]: result.assets[0].uri }));
        setSelectedId(replacement.id);
      }
      setMe(latest);
    });
  }

  const handleMove = (photoId: string, to: -1 | 1 | "front") =>
    run("Saving…", async () => setMe(await reorderPhotos(moved(ids, photoId, to))));

  const handleRemove = (photoId: string) =>
    run("Removing…", async () => {
      setMe(await deletePhoto(photoId));
      if (selectedId === photoId) setSelectedId(undefined);
    });

  return (
    <Screen
      header={
        editing ? (
          <TopBar title="Your photos" onBack={() => router.back()} />
        ) : (
          <OnboardingHeader step={4} onBack={onboardingBack("photos")} />
        )
      }
    >
      {editing ? null : (
        <StepMeta label="Step 4 of 6: Photo verification" right={{ kind: "mark", label: "Dignity Assured" }} />
      )}
      <View className="gap-1.5">
        <AppText weight="bold" className="text-[26px] leading-8">
          Add your photos
        </AppText>
        <AppText tone="muted" className="text-[17px] leading-6">
          Add at least {MIN_PHOTOS} clear, recent photos of yourself. You can add up to {MAX_PHOTOS}.
        </AppText>
      </View>

      <View className="flex-row items-center gap-3 rounded-2xl bg-sand p-3">
        <View className="h-8 w-8 items-center justify-center rounded-full bg-verified-soft">
          <Icon name="check-circle" size={18} color="verified" />
        </View>
        <View className="flex-1">
          <AppText weight="bold" className="text-sm">
            {count} of {MAX_PHOTOS} photos added
          </AppText>
          <AppText weight="semibold" tone={count >= MIN_PHOTOS ? "verified" : "muted"} className="text-xs">
            {count >= MIN_PHOTOS
              ? "Minimum requirement met"
              : `Add ${MIN_PHOTOS - count} more to continue`}
          </AppText>
        </View>
        <View className="flex-row gap-1">
          {Array.from({ length: MAX_PHOTOS }, (_, i) => (
            <View key={i} className={`h-2 w-2 rounded-full ${i < count ? "bg-verified" : "bg-sand-dark"}`} />
          ))}
        </View>
      </View>

      <View
        className="flex-row flex-wrap"
        style={{ gap: GAP }}
        onLayout={(event: LayoutChangeEvent) => setGridWidth(event.nativeEvent.layout.width)}
      >
        {tile > 0
          ? Array.from({ length: MAX_PHOTOS }, (_, index) => {
              const photo = me.photos[index];
              const size = { width: tile, height: tile * 1.05 };
              if (!photo) {
                const first = index === count;
                return (
                  <Pressable
                    key={`empty-${index}`}
                    accessibilityRole="button"
                    accessibilityLabel="Add photo"
                    onPress={handleAdd}
                    style={size}
                    className="items-center justify-center gap-1.5 rounded-2xl bg-sand"
                  >
                    <View className={`h-8 w-8 items-center justify-center rounded-full ${first ? "bg-wine-soft" : "bg-sand-dark"}`}>
                      <Icon name="plus" size={18} color={first ? "wine" : "inkMuted"} />
                    </View>
                    {first ? (
                      <AppText weight="semibold" className="text-xs">
                        {busy === "Uploading…" ? "Uploading…" : "Add photo"}
                      </AppText>
                    ) : null}
                  </Pressable>
                );
              }
              const selected = photo.id === selectedId;
              // The tile's tap area and the × are siblings: a button inside a button breaks taps (and web).
              return (
                <View
                  key={photo.id}
                  style={size}
                  className={`overflow-hidden rounded-2xl border-2 bg-sand ${selected ? "border-wine" : "border-transparent"}`}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Photo ${index + 1}${index === 0 ? ", main photo" : ""}`}
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedId(selected ? undefined : photo.id)}
                    className="h-full w-full"
                  >
                    {previews[photo.id] ? (
                      <Image source={{ uri: previews[photo.id] }} className="h-full w-full" />
                    ) : (
                      <AuthImage path={`/v1/me/photos/${photo.id}`} className="h-full w-full" />
                    )}
                  </Pressable>
                  {index === 0 ? (
                    <View
                      pointerEvents="none"
                      className="absolute left-1.5 top-1.5 flex-row items-center gap-0.5 rounded-full bg-wine px-2 py-0.5"
                    >
                      <Icon name="star" size={10} color="white" />
                      <AppText weight="bold" tone="white" className="text-[11px]">
                        Main
                      </AppText>
                    </View>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove photo ${index + 1}`}
                    hitSlop={8}
                    onPress={() => handleRemove(photo.id)}
                    className="absolute right-1.5 top-1.5 h-6 w-6 items-center justify-center rounded-full bg-white"
                  >
                    <Icon name="close" size={14} color="ink" />
                  </Pressable>
                </View>
              );
            })
          : null}
      </View>

      {selectedId && selectedIndex >= 0 ? (
        <View className="gap-2">
          <AppText weight="semibold" tone="muted" className="text-sm">
            Photo {selectedIndex + 1} selected
          </AppText>
          <View className="flex-row flex-wrap gap-2">
            {selectedIndex > 0 ? (
              <PhotoAction icon="star-outline" label="Make main" onPress={() => handleMove(selectedId, "front")} />
            ) : null}
            {selectedIndex > 0 ? (
              <PhotoAction icon="arrow-left" label="Move left" onPress={() => handleMove(selectedId, -1)} />
            ) : null}
            {selectedIndex < ids.length - 1 ? (
              <PhotoAction icon="arrow-right" label="Move right" onPress={() => handleMove(selectedId, 1)} />
            ) : null}
            <PhotoAction icon="image-edit-outline" label="Replace" onPress={() => handleReplace(selectedId)} />
          </View>
        </View>
      ) : count > 1 ? (
        <AppText tone="muted" className="text-sm">
          Tap a photo to change it or move it. The first photo is your main photo.
        </AppText>
      ) : null}

      <View className="gap-3 rounded-2xl bg-sand p-4">
        <View className="flex-row items-center gap-2">
          <Icon name="thumb-up-outline" size={18} color="verified" />
          <AppText weight="bold" className="text-base">
            Guidelines for Genuine Connection
          </AppText>
        </View>
        {GUIDELINES.map((line) => (
          <View key={line} className="flex-row items-center gap-2.5">
            <View className="h-5 w-5 items-center justify-center rounded-full bg-verified-soft">
              <Icon name="check" size={13} color="verified" />
            </View>
            <AppText className="text-[15px]">{line}</AppText>
          </View>
        ))}
      </View>

      {error ? <ErrorBanner message={error} /> : null}
      <View className="gap-2 pt-1">
        <Button
          label={busy && busy !== "Uploading…" ? busy : editing ? "Done" : "Continue"}
          trailingIcon={busy || editing ? undefined : "arrow-right"}
          disabled={count < MIN_PHOTOS || Boolean(busy)}
          onPress={() => (editing ? router.back() : advance(me, "photos"))}
        />
        <AppText weight="semibold" tone="muted" className="text-center text-xs">
          Your photos are stored securely and only shown to verified members.
        </AppText>
      </View>
    </Screen>
  );
}
