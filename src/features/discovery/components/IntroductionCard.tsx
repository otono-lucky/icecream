import type { MemberCard } from "@contracts";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { DecisionButtons, DecisionStatus, useDecision } from "@/features/interests";
import { useStartConversation } from "@/features/messaging";
import { shortFacts } from "@/features/profile";
import { memberPhotoPath } from "@/shared/lib/apiPaths";
import { routes } from "@/shared/navigation/routes";
import { AppText, Button, ErrorBanner, Icon, PhotoCarousel } from "@/shared/ui";

function Badge({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-verified-soft px-2.5 py-1">
      <Icon name="check-circle" size={12} color="verified" />
      <AppText weight="bold" tone="verified" className="text-[11px]">
        {label}
      </AppText>
    </View>
  );
}

/** One introduction on the Today screen: photos to swipe through, then why they were suggested. */
export function IntroductionCard({ member: initial }: { member: MemberCard }) {
  const { card: member, decide, saving, error } = useDecision(initial);
  const startConversation = useStartConversation();
  const facts = member.profile ? shortFacts(member.profile) : "";

  return (
    <View className="flex-1 overflow-hidden rounded-3xl bg-white">
      <PhotoCarousel paths={member.photoIds.map((id) => memberPhotoPath(member.id, id))}>
        <LinearGradient
          pointerEvents="none"
          colors={["transparent", "rgba(0,0,0,0.7)"]}
          locations={[0.55, 1]}
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
        />
        <View pointerEvents="none" className="absolute bottom-0 left-0 right-0 gap-2 p-4">
          <View className="flex-row flex-wrap gap-1.5">
            {member.badges.includes("photo") ? <Badge label="Photo verified" /> : null}
            {member.badges.includes("governmentId") ? <Badge label="ID verified" /> : null}
          </View>
          <AppText weight="bold" tone="white" className="text-[26px] leading-8">
            {member.firstName}, {member.age}
          </AppText>
          <View className="flex-row items-center gap-1">
            <Icon name="map-marker-outline" size={16} color="white" />
            <AppText weight="medium" tone="white" className="text-[15px]">
              {member.city}
            </AppText>
          </View>
          {facts ? (
            <AppText weight="semibold" tone="white" className="text-sm" numberOfLines={1}>
              {facts}
            </AppText>
          ) : null}
        </View>
      </PhotoCarousel>

      <View className="gap-3 p-4">
        <DecisionStatus card={member} fallback={member.reason} />
        {error ? <ErrorBanner message={error} /> : null}
        <DecisionButtons
          card={member}
          saving={saving}
          onDecide={(decision) => void decide(decision)}
          extra={
            // Start a chat straight from the card: the chat, or the plans screen if a plan is needed.
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Message ${member.firstName}`}
              onPress={() => startConversation(member)}
              className="h-[52px] w-[52px] items-center justify-center rounded-full bg-sand active:bg-sand-dark"
            >
              <Icon name="message-text-outline" size={22} color="wine" />
            </Pressable>
          }
        >
          <Button label="View profile" variant="secondary" onPress={() => router.push(routes.member(member.id))} />
        </DecisionButtons>
      </View>
    </View>
  );
}
