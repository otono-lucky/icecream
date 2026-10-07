import type { MemberCard } from "@contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";

import { useAsync } from "@/shared/lib/useAsync";
import { memberPhotoPath } from "@/shared/lib/apiPaths";
import { routes } from "@/shared/navigation/routes";
import { AppText, AuthImage, Button, ErrorBanner, Icon, Screen } from "@/shared/ui";

import { getReceivedInterests } from "../api/interestsApi";
import { DecisionStatus } from "../components/DecisionStatus";
import { useDecision } from "../hooks/useDecision";

function ReceivedInterestRow({ member, onDeclined }: { member: MemberCard; onDeclined: (id: string) => void }) {
  const { card, decide, saving, error } = useDecision(member);
  const mainPhoto = card.photoIds[0];

  async function decline() {
    if (await decide("pass")) onDeclined(card.id);
  }

  return (
    <View className="gap-3 rounded-2xl bg-white p-3">
      <Pressable accessibilityRole="button" onPress={() => router.push(routes.member(card.id))} className="flex-row items-center gap-3">
        <View className="h-16 w-16 overflow-hidden rounded-xl bg-sand">
          {mainPhoto ? <AuthImage path={memberPhotoPath(card.id, mainPhoto)} className="h-full w-full" /> : null}
        </View>
        <View className="flex-1">
          <AppText weight="bold" className="text-lg">
            {card.firstName}, {card.age}
          </AppText>
          <View className="flex-row items-center gap-1">
            <Icon name="map-marker-outline" size={14} color="inkMuted" />
            <AppText tone="muted" className="text-sm">
              {card.city}
            </AppText>
          </View>
        </View>
        <Icon name="chevron-right" size={20} color="inkMuted" />
      </Pressable>
      <DecisionStatus card={card} />
      {error ? <ErrorBanner message={error} /> : null}
      {card.decision !== "interest" ? (
        <View className="gap-1">
          <Button
            label={saving === "interest" ? "Saving…" : "I’m interested too"}
            leadingIcon={saving ? undefined : "heart-outline"}
            disabled={Boolean(saving)}
            onPress={() => void decide("interest")}
          />
          <Button
            label={saving === "pass" ? "Saving…" : "Not for me"}
            variant="text"
            disabled={Boolean(saving)}
            onPress={() => void decline()}
          />
        </View>
      ) : null}
    </View>
  );
}

/** People who have expressed interest in you. Declining is quiet: they are never told (PRD 4.3). */
export function InterestsReceivedScreen() {
  const [reloadKey, setReloadKey] = useState(0);
  const interests = useAsync(getReceivedInterests, [reloadKey]);
  const [declined, setDeclined] = useState<string[]>([]);

  // Pick up new interest whenever the tab comes back into view.
  useFocusEffect(useCallback(() => setReloadKey((key) => key + 1), []));

  const list = interests.data?.interests.filter((member) => !declined.includes(member.id)) ?? [];

  return (
    <Screen title="Interested in you" subtitle="Only you can see this. Saying “not for me” is private: they’re never told.">
      {interests.status === "error" ? (
        <ErrorBanner message="Couldn’t load your interests. Check your connection and try again." />
      ) : null}
      {interests.status === "success" && list.length === 0 ? (
        <View className="items-center gap-3 rounded-2xl bg-sand p-8">
          <Icon name="heart-outline" size={30} color="wine" />
          <AppText weight="bold" className="text-center text-lg">
            No new interest yet
          </AppText>
          <AppText tone="muted" className="text-center text-[15px] leading-6">
            When someone is interested in you, they’ll appear here.
          </AppText>
        </View>
      ) : null}
      {list.map((member) => (
        <ReceivedInterestRow
          key={member.id}
          member={member}
          onDeclined={(id) => setDeclined((current) => [...current, id])}
        />
      ))}
    </Screen>
  );
}
