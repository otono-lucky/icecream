import type { MemberCard } from "@contracts";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMe } from "@/features/auth";
import { useMyProfile } from "@/features/profile";
import { useAsync } from "@/shared/lib/useAsync";
import { routes } from "@/shared/navigation/routes";
import { AppText, AuthImage, Button, Icon, Wordmark } from "@/shared/ui";

import { getToday } from "../api/discoveryApi";
import { IntroductionCard } from "../components/IntroductionCard";

const END_OF_TODAY = "end-of-today";
type Page = MemberCard | typeof END_OF_TODAY;

function greeting(now = new Date()) {
  const hour = now.getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function Header({ count }: { count: number | undefined }) {
  const me = useMe();
  const insets = useSafeAreaInsets();
  const mainPhoto = me.photos[0];
  const { profile } = useMyProfile();
  const hidden = profile && !profile.publishedAt;

  return (
    <View className="gap-3 px-5 pb-3" style={{ paddingTop: insets.top + 8 }}>
      <View className="flex-row items-center justify-between">
        <Wordmark />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Your profile"
          onPress={() => router.push(routes.me)}
          className="h-9 w-9 overflow-hidden rounded-full bg-sand"
        >
          {mainPhoto ? <AuthImage path={`/v1/me/photos/${mainPhoto.id}`} className="h-full w-full" /> : null}
        </Pressable>
      </View>
      <View className="gap-1">
        <AppText tone="muted" className="text-[15px]">
          {greeting()}, {me.user.firstName}
        </AppText>
        <View className="flex-row items-center justify-between gap-3">
          <AppText weight="bold" className="flex-1 text-[22px] leading-7" numberOfLines={1}>
            Today’s introductions
          </AppText>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(routes.filters)}
            className="min-h-[40px] flex-row items-center gap-1.5 rounded-full bg-sand px-3.5 active:bg-sand-dark"
          >
            <Icon name="tune-variant" size={16} color="ink" />
            <AppText weight="semibold" className="text-sm">
              Filters
            </AppText>
          </Pressable>
        </View>
        {count ? (
          <View className="flex-row items-center gap-2">
            <View className="h-1.5 w-1.5 rounded-full bg-wine" />
            <AppText tone="muted" className="flex-1 text-sm">
              {count === 1 ? "1 person" : `${count} people`} chosen for you. New introductions tomorrow morning.
            </AppText>
          </View>
        ) : null}
      </View>
      {hidden ? (
        // Only published profiles are introduced to others (PRD 4.2).
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(profile.sectionsDone.length === 6 ? routes.profilePreview : routes.profileIntro)}
          className="flex-row items-center gap-3 rounded-2xl bg-wine-soft px-4 py-3 active:opacity-80"
        >
          <Icon name="account-edit-outline" size={20} color="wine" />
          <View className="flex-1">
            <AppText weight="bold" tone="wine" className="text-sm">
              Others can’t see you yet
            </AppText>
            <AppText tone="muted" className="text-[13px]">
              Finish your profile to be introduced. About 5 minutes.
            </AppText>
          </View>
          <Icon name="chevron-right" size={20} color="wine" />
        </Pressable>
      ) : null}
    </View>
  );
}

function EndOfToday() {
  return (
    <View className="flex-1 items-center justify-center gap-3 rounded-3xl bg-sand p-8">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-white">
        <Icon name="white-balance-sunny" size={26} color="review" />
      </View>
      <AppText weight="bold" className="text-center text-xl">
        That’s everyone for today
      </AppText>
      <AppText tone="muted" className="text-center text-[15px] leading-6">
        New introductions arrive tomorrow morning. Take your time with today’s.
      </AppText>
    </View>
  );
}

function Message({ icon, title, body, action }: { icon: "account-heart-outline" | "wifi-off"; title: string; body: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-sand">
        <Icon name={icon} size={30} color="wine" />
      </View>
      <AppText weight="bold" className="text-center text-xl">
        {title}
      </AppText>
      <AppText tone="muted" className="text-center text-[15px] leading-6">
        {body}
      </AppText>
      {action ? <Button label={action.label} variant="secondary" onPress={action.onPress} /> : null}
    </View>
  );
}

/**
 * Today: a few introductions, one per screen. Swipe up for the next person, and left or right on a
 * photo for their other pictures. Deliberately not an endless feed (PRD 3.3).
 */
export function DailyMatchesScreen() {
  const [reloadKey, setReloadKey] = useState(0);
  const today = useAsync(getToday, [reloadKey]);
  const [pageHeight, setPageHeight] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);

  const introductions = today.data?.introductions;
  const pages: Page[] = introductions?.length ? [...introductions, END_OF_TODAY] : [];
  const onLayout = (event: LayoutChangeEvent) => setPageHeight(event.nativeEvent.layout.height);

  return (
    <View className="flex-1 bg-ivory">
      <Header count={introductions?.length} />
      <View className="flex-1" onLayout={onLayout}>
        {today.status === "loading" ? (
          <View className="flex-1 px-5 pb-4">
            <View className="flex-1 rounded-3xl bg-sand" />
          </View>
        ) : today.status === "error" ? (
          <Message
            icon="wifi-off"
            title="Couldn’t load today’s introductions"
            body="Check your connection and try again."
            action={{ label: "Try again", onPress: () => setReloadKey((key) => key + 1) }}
          />
        ) : !introductions?.length ? (
          <Message
            icon="account-heart-outline"
            title="Your first introductions are on their way"
            body="We’re finding people who fit what you’re looking for. Check back tomorrow morning."
          />
        ) : pageHeight > 0 ? (
          <FlatList
            data={pages}
            keyExtractor={(page) => (page === END_OF_TODAY ? page : page.id)}
            pagingEnabled
            snapToInterval={pageHeight}
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            getItemLayout={(_, index) => ({ length: pageHeight, offset: pageHeight * index, index })}
            onMomentumScrollEnd={(event) => setPageIndex(Math.round(event.nativeEvent.contentOffset.y / pageHeight))}
            onScroll={(event) => setPageIndex(Math.round(event.nativeEvent.contentOffset.y / pageHeight))}
            scrollEventThrottle={64}
            renderItem={({ item, index }) => (
              <View style={{ height: pageHeight }} className="px-5 pb-3">
                {item === END_OF_TODAY ? <EndOfToday /> : <IntroductionCard member={item} />}
                {index === 0 && pageIndex === 0 && pages.length > 1 ? (
                  <View pointerEvents="none" className="flex-row items-center justify-center gap-1 pt-2">
                    <Icon name="chevron-up" size={16} color="inkMuted" />
                    <AppText tone="muted" className="text-xs">
                      Swipe up for the next introduction
                    </AppText>
                  </View>
                ) : null}
              </View>
            )}
          />
        ) : null}
      </View>
    </View>
  );
}
