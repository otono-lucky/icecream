import { LABELS, type MemberCard, type PartnerFaithImportance, type ProfileAnswers, type YesMaybeNo } from "@contracts";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMe } from "@/features/auth";
import { DecisionButtons, DecisionStatus, useDecision } from "@/features/interests";
import { useStartConversation } from "@/features/messaging";
import { profileFacts, type Pronoun } from "@/features/profile";
import { SafetyActions, useConfirmBlock } from "@/features/safety";
import { memberPhotoPath } from "@/shared/lib/apiPaths";
import { routes } from "@/shared/navigation/routes";
import { AppText, Button, ErrorBanner, Icon, PhotoCarousel, Screen, type IconName } from "@/shared/ui";

import { useMember } from "../hooks/useMember";

export function MemberProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const member = useMember(id);
  const insets = useSafeAreaInsets();

  if (member.status === "loading") return <View className="flex-1 bg-ivory" />;
  if (member.status === "error") {
    return (
      <View className="flex-1 bg-ivory">
        <View className="px-5" style={{ paddingTop: insets.top + 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} onPress={() => router.back()}>
            <Icon name="arrow-left" size={24} />
          </Pressable>
        </View>
        <Screen>
          <AppText tone="muted">This profile is no longer available.</AppText>
        </Screen>
      </View>
    );
  }

  return <MemberProfile member={member.data} />;
}

const PARTNER_FAITH: Record<PartnerFaithImportance, string> = {
  must_match: "Must match — essential requirement for shared worship & home unity.",
  prefer_match: "Would prefer it to match — open to sincere mutual respect.",
  doesnt_matter: "Doesn’t matter — character, honor, and shared life vision take precedence.",
};

const PARTNER_CHILDREN: Record<YesMaybeNo, string> = {
  yes: "Yes, warmly welcoming to partner’s children.",
  maybe: "Maybe, depending on the person.",
  no: "Prefers a partner without children.",
};

const RELOCATE: Record<YesMaybeNo, string> = {
  yes: "Open to relocate",
  maybe: "Open to relocate for the right person",
  no: "Not looking to relocate",
};

function childrenText(a: ProfileAnswers, who: Pronoun) {
  if (!a.hasChildren) return "No children";
  const count = a.childrenCount ?? 0;
  const children = `${count} ${count === 1 ? "child" : "children"}`;
  const living =
    a.childrenLiveWith === "all"
      ? count === 1
        ? `lives with ${who}`
        : count === 2
          ? `both live with ${who}`
          : `all live with ${who}`
      : a.childrenLiveWith === "some"
        ? `some live with ${who}`
        : "live elsewhere or are grown";
  return `Has ${children} (${living})`;
}

function SectionLabel({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between pt-2">
      <AppText weight="bold" tone="muted" className="text-[11px] tracking-wider">
        {children.toUpperCase()}
      </AppText>
      {right}
    </View>
  );
}

/** A white detail card: an icon in a sand circle, a small caption, the answer, and an optional inner note. */
function DetailCard({ icon, caption, title, body, note }: { icon: IconName; caption?: string; title: string; body?: string | null; note?: { caption: string; text: string } }) {
  return (
    <View className="gap-3 rounded-2xl bg-white p-4">
      <View className="flex-row items-start gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-sand">
          <Icon name={icon} size={18} color="inkMuted" />
        </View>
        <View className="flex-1">
          {caption ? (
            <AppText weight="semibold" tone="muted" className="text-xs">
              {caption}
            </AppText>
          ) : null}
          <AppText weight="bold" className={caption ? "text-base leading-6" : "text-[18px] leading-6"}>
            {title}
          </AppText>
        </View>
      </View>
      {body ? (
        <AppText tone="muted" className="text-[15px] leading-6">
          {body}
        </AppText>
      ) : null}
      {note ? (
        <View className="gap-0.5 rounded-xl bg-sand p-3">
          <AppText weight="bold" tone="muted" className="text-xs">
            {note.caption}
          </AppText>
          <AppText className="text-[15px] leading-[22px]">{note.text}</AppText>
        </View>
      ) : null}
    </View>
  );
}

function MemberProfile({ member: initial }: { member: MemberCard }) {
  const { card: member, decide, saving, error } = useDecision(initial);
  const startConversation = useStartConversation();
  const insets = useSafeAreaInsets();
  const viewer = useMe();
  const [menuOpen, setMenuOpen] = useState(false);
  const who: Pronoun = viewer.user.gender === "woman" ? "him" : "her";
  const a = member.profile;
  const confirmBlock = useConfirmBlock({ memberId: member.id, memberName: member.firstName, onBlocked: () => router.back() });

  return (
    <View className="flex-1 bg-ivory">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ height: 520 }}>
          <PhotoCarousel paths={member.photoIds.map((id) => memberPhotoPath(member.id, id))}>
            <LinearGradient
              pointerEvents="none"
              colors={["transparent", "rgba(0,0,0,0.75)"]}
              locations={[0.55, 1]}
              style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
            />
            <View pointerEvents="none" className="absolute bottom-0 left-0 right-0 gap-1.5 p-5">
              <AppText weight="bold" tone="white" className="text-[30px] leading-9">
                {member.firstName}, {member.age}
              </AppText>
              <View className="flex-row items-center gap-1">
                <Icon name="map-marker-outline" size={16} color="white" />
                <AppText weight="medium" tone="white" className="text-[15px]">
                  {member.city}
                </AppText>
              </View>
              <View className="flex-row flex-wrap gap-1.5 pt-1">
                {member.badges.map((badge) => (
                  <View key={badge} className="flex-row items-center gap-1 rounded-full bg-verified-soft px-2.5 py-1">
                    <Icon name="check-circle" size={12} color="verified" />
                    <AppText weight="bold" tone="verified" className="text-[11px] tracking-wide">
                      {badge === "governmentId" ? "ID VERIFIED" : "PHOTO VERIFIED"}
                    </AppText>
                  </View>
                ))}
              </View>
            </View>
          </PhotoCarousel>
          <View className="absolute left-4 right-4 flex-row justify-between" style={{ top: insets.top + 16 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => router.back()}
              className="h-10 w-10 items-center justify-center rounded-full bg-white/80"
            >
              <Icon name="arrow-left" size={22} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="More options"
              onPress={() => setMenuOpen((open) => !open)}
              className="h-10 w-10 items-center justify-center rounded-full bg-white/80"
            >
              <Icon name="dots-vertical" size={22} />
            </Pressable>
          </View>
          {menuOpen ? (
            <View className="absolute right-4 w-44 overflow-hidden rounded-xl bg-white" style={{ top: insets.top + 64 }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setMenuOpen(false);
                  router.push(routes.report(member.id));
                }}
                className="flex-row items-center gap-2 px-4 py-3 active:bg-sand"
              >
                <Icon name="flag-outline" size={18} color="inkMuted" />
                <AppText className="text-[15px]">Report</AppText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setMenuOpen(false);
                  confirmBlock();
                }}
                className="flex-row items-center gap-2 border-t border-sand px-4 py-3 active:bg-sand"
              >
                <Icon name="block-helper" size={18} color="danger" />
                <AppText tone="danger" className="text-[15px]">
                  Block {member.firstName}
                </AppText>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View className="gap-4 px-5 pt-5">
          {a ? (
            <View className="flex-row flex-wrap gap-2">
              {profileFacts(a, who).map((fact) => (
                <View key={fact.label} className="flex-row items-center gap-1.5 rounded-full bg-sand px-3 py-2">
                  <Icon name={fact.icon} size={15} color="wine" />
                  <AppText weight="semibold" className="text-[13px]">
                    {fact.label}
                  </AppText>
                </View>
              ))}
            </View>
          ) : null}

          {member.decision || member.interestedInYou ? <DecisionStatus card={member} /> : null}

          {a?.lookingFor ? (
            <>
              <SectionLabel
                right={
                  <View className="rounded-full bg-wine px-3 py-1">
                    <AppText weight="bold" tone="white" className="text-[11px] tracking-wider">
                      {LABELS.lookingFor[a.lookingFor].toUpperCase()}
                    </AppText>
                  </View>
                }
              >
                Intent & seeking
              </SectionLabel>
              {a.ownWords ? (
                <View className="gap-2 overflow-hidden rounded-2xl bg-sand p-5">
                  <AppText weight="extrabold" className="absolute right-4 top-0 text-[72px] text-sand-dark">
                    ”
                  </AppText>
                  <Icon name="format-quote-open" size={22} color="wine" />
                  <AppText className="text-base italic leading-7">“{a.ownWords}”</AppText>
                </View>
              ) : null}
            </>
          ) : null}

          <View className="flex-row gap-3 rounded-2xl bg-sand-dark p-4">
            <View className="h-9 w-9 items-center justify-center rounded-lg bg-wine-soft">
              <Icon name="star-four-points-outline" size={18} color="wine" />
            </View>
            <View className="flex-1 gap-0.5">
              <AppText weight="bold" className="text-[15px]">
                Why we suggested {member.firstName}
              </AppText>
              <AppText tone="muted" className="text-[15px] leading-[22px]">
                {member.reason}
              </AppText>
            </View>
          </View>

          {a?.occupation ? (
            <>
              <SectionLabel>Work & daily life</SectionLabel>
              <DetailCard icon="briefcase-outline" title={a.occupation} body={a.typicalWeek} />
            </>
          ) : null}

          {a?.faith ? (
            <>
              <SectionLabel>Faith & alignment</SectionLabel>
              <DetailCard
                icon="hands-pray"
                caption="Faith background"
                title={
                  a.faith === "none" || !a.faithPractice
                    ? LABELS.faith[a.faith]
                    : `${LABELS.faith[a.faith]} (${LABELS.faithPractice[a.faithPractice].toLowerCase()})`
                }
                note={a.partnerFaithImportance ? { caption: "Partner faith preference", text: PARTNER_FAITH[a.partnerFaithImportance] } : undefined}
              />
            </>
          ) : null}

          {a && a.hasChildren !== null ? (
            <>
              <SectionLabel>Children & household</SectionLabel>
              <DetailCard
                icon="home-outline"
                caption="Current family"
                title={childrenText(a, who)}
                note={
                  a.openToPartnerWithChildren
                    ? { caption: "Openness to partner’s children", text: PARTNER_CHILDREN[a.openToPartnerWithChildren] }
                    : undefined
                }
              />
            </>
          ) : null}

          <SectionLabel>Location & mobility</SectionLabel>
          <DetailCard
            icon="map-marker-outline"
            title={member.city}
            body={a?.relocate ? RELOCATE[a.relocate] : undefined}
          />

          {!a ? (
            <AppText tone="muted" className="text-center text-sm">
              {member.firstName} hasn’t finished {who === "her" ? "her" : "his"} profile yet.
            </AppText>
          ) : null}

          <SafetyActions memberId={member.id} memberName={member.firstName} onBlocked={() => router.back()} />
        </View>
      </ScrollView>

      <View className="gap-2 border-t border-sand-dark bg-white px-5 pt-3" style={{ paddingBottom: insets.bottom + 10 }}>
        {error ? <ErrorBanner message={error} /> : null}
        <DecisionButtons card={member} saving={saving} onDecide={(decision) => void decide(decision)}>
          <Button
            label="Message"
            variant="secondary"
            leadingIcon="message-text-outline"
            onPress={() => startConversation(member)}
          />
        </DecisionButtons>
      </View>
    </View>
  );
}
