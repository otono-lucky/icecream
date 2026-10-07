import {
  LABELS,
  MAX_OWN_WORDS,
  MAX_TYPICAL_WEEK,
  type ChildrenLiveWith,
  type Faith,
  type FaithPractice,
  type LookingFor,
  type MaritalStatus,
  type PartnerFaithImportance,
  type ProfileAnswers,
  type ProfileSection,
  type ProfileSectionBody,
  type YesMaybeNo,
} from "@contracts";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { CityPickerModal } from "@/features/verification";
import { AppText, colors, Icon, noWebFocusRing } from "@/shared/ui";

import { ChoiceCard, ChoiceTile, InfoCard, PillRow, Question, StackedTile, TextBox } from "../components/ProfileParts";
import {
  FAITH_OPTIONS,
  LIVE_WITH_HINTS,
  LOOKING_FOR_OPTIONS,
  MARITAL_HINTS,
  PARTNER_FAITH_OPTIONS,
  PRACTICE_HINTS,
} from "../sections";

/** The answers being edited on a section screen, plus the member's city (Where you live can change it). */
export type Draft = ProfileAnswers & { city: string };

export type FormProps = {
  draft: Draft;
  set: (patch: Partial<Draft>) => void;
  /** Building the profile for the first time, or editing one section from the profile. */
  mode: "build" | "edit";
};

const keys = <T extends string>(record: Record<T, unknown>) => Object.keys(record) as T[];

/** The request body for a section, or null while a required answer is missing. */
export function sectionBody<S extends ProfileSection>(section: S, d: Draft): ProfileSectionBody[S] | null {
  const body = ((): ProfileSectionBody[ProfileSection] | null => {
    switch (section) {
      case "marital-history":
        return d.maritalStatus ? { maritalStatus: d.maritalStatus } : null;
      case "children":
        if (d.hasChildren === null || !d.openToPartnerWithChildren) return null;
        if (d.hasChildren && (!d.childrenCount || !d.childrenLiveWith)) return null;
        return d.hasChildren
          ? {
              hasChildren: true,
              childrenCount: d.childrenCount!,
              childrenLiveWith: d.childrenLiveWith!,
              openToPartnerWithChildren: d.openToPartnerWithChildren,
            }
          : { hasChildren: false, openToPartnerWithChildren: d.openToPartnerWithChildren };
      case "faith":
        return d.faith && d.faithPractice && d.partnerFaithImportance
          ? { faith: d.faith, faithPractice: d.faithPractice, partnerFaithImportance: d.partnerFaithImportance }
          : null;
      case "location":
        return d.relocate ? { city: d.city || undefined, relocate: d.relocate } : null;
      case "work":
        return d.occupation?.trim()
          ? { occupation: d.occupation.trim(), typicalWeek: d.typicalWeek?.trim() || undefined }
          : null;
      case "looking-for":
        return d.lookingFor ? { lookingFor: d.lookingFor, ownWords: d.ownWords?.trim() || undefined } : null;
      default:
        return null;
    }
  })();
  return body as ProfileSectionBody[S] | null;
}

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View className="gap-1.5">
      <AppText weight="bold" className="text-[26px] leading-8">
        {title}
      </AppText>
      <AppText tone="muted" className="text-[16px] leading-6">
        {subtitle}
      </AppText>
    </View>
  );
}

function MaritalHistory({ draft, set, mode }: FormProps) {
  return (
    <>
      <Heading title="Your marital history" subtitle="So others understand your situation without having to ask." />
      <View className="gap-3" accessibilityRole="radiogroup">
        {keys<MaritalStatus>(LABELS.maritalStatus).map((status) => (
          <ChoiceCard
            key={status}
            label={LABELS.maritalStatus[status]}
            hint={MARITAL_HINTS[status]}
            selected={draft.maritalStatus === status}
            onPress={() => set({ maritalStatus: status })}
          />
        ))}
      </View>
      {draft.maritalStatus === "widowed" ? (
        <InfoCard icon="shield-outline" iconColor={mode === "edit" ? "verified" : "wine"} title="We’re sorry for your loss.">
          This is quietly presented simply as “Widowed” on your profile, ensuring clarity and discretion.
        </InfoCard>
      ) : null}
      {mode === "build" ? (
        <InfoCard icon="lock" kicker="Your privacy">
          Your answers are shown only to verified members.
        </InfoCard>
      ) : null}
    </>
  );
}

const COUNTS = [1, 2, 3, 4, 5].map((n) => ({ value: n, label: n === 5 ? "5+" : String(n) }));

function Children({ draft, set }: FormProps) {
  return (
    <>
      <Heading title="Children" subtitle="Intentional connections start with complete clarity around family life." />
      <View className="gap-3">
        <Question title="Do you have children?" />
        <View className="flex-row gap-3" accessibilityRole="radiogroup">
          <ChoiceTile
            label="Yes"
            icon="human-male-female-child"
            selected={draft.hasChildren === true}
            onPress={() => set({ hasChildren: true })}
          />
          <ChoiceTile
            label="No"
            icon="account-outline"
            selected={draft.hasChildren === false}
            onPress={() => set({ hasChildren: false, childrenCount: null, childrenLiveWith: null })}
          />
        </View>
      </View>

      {draft.hasChildren ? (
        <>
          <View className="gap-3">
            <Question title="How many?" />
            <PillRow options={COUNTS} value={draft.childrenCount && Math.min(draft.childrenCount, 5)} onChange={(n) => set({ childrenCount: n })} />
          </View>
          <View className="gap-3" accessibilityRole="radiogroup">
            <Question title="Do they live with you?" />
            {keys<ChildrenLiveWith>(LABELS.childrenLiveWith).map((option) => (
              <ChoiceCard
                key={option}
                label={LABELS.childrenLiveWith[option]}
                hint={LIVE_WITH_HINTS[option]}
                selected={draft.childrenLiveWith === option}
                onPress={() => set({ childrenLiveWith: option })}
              />
            ))}
          </View>
        </>
      ) : null}

      <View className="gap-3">
        <Question title="Are you open to a partner who has children?" help="We prioritize your preferred family dynamic." large />
        <View className="flex-row gap-3" accessibilityRole="radiogroup">
          {keys<YesMaybeNo>(LABELS.yesMaybeNo).map((option) => (
            <StackedTile
              key={option}
              label={LABELS.yesMaybeNo[option]}
              selected={draft.openToPartnerWithChildren === option}
              onPress={() => set({ openToPartnerWithChildren: option })}
            />
          ))}
        </View>
      </View>

      <InfoCard icon="shield-check-outline" kicker="Privacy & discretion">
        Only how many children you have and whether they live with you are shown, and only to verified members.
      </InfoCard>
    </>
  );
}

function FaithForm({ draft, set }: FormProps) {
  return (
    <>
      <Heading
        title="Faith"
        subtitle="In our community, mutual spiritual grounding and respect form the bedrock of lasting, intentional relationships."
      />
      <InfoCard icon="shield-check" title="Discreet & Respected">
        Your answers appear on your profile and help us suggest people who share your values.
      </InfoCard>

      <View className="gap-3" accessibilityRole="radiogroup">
        <Question title="Your faith" help="Select the spiritual foundation that best reflects your life." large />
        {keys<Faith>(LABELS.faith).map((faith) => (
          <ChoiceCard
            key={faith}
            label={LABELS.faith[faith]}
            hint={FAITH_OPTIONS[faith].hint}
            icon={FAITH_OPTIONS[faith].icon}
            selected={draft.faith === faith}
            onPress={() => set({ faith })}
          />
        ))}
      </View>

      <View className="gap-3" accessibilityRole="radiogroup">
        <Question title="How do you practise?" help="Helps calibrate day-to-day rhythm and communal lifestyle expectations." large />
        {keys<FaithPractice>(LABELS.faithPractice).map((practice) => (
          <ChoiceCard
            key={practice}
            label={LABELS.faithPractice[practice]}
            hint={PRACTICE_HINTS[practice]}
            selected={draft.faithPractice === practice}
            onPress={() => set({ faithPractice: practice })}
          />
        ))}
      </View>

      <View className="gap-3" accessibilityRole="radiogroup">
        <Question
          title="How important is your partner’s faith to you?"
          help="Helps us balance household peace, extended family relations, and compatibility."
          large
        />
        {keys<PartnerFaithImportance>(LABELS.partnerFaithImportance).map((importance) => (
          <ChoiceCard
            key={importance}
            label={LABELS.partnerFaithImportance[importance].replace("'", "’")}
            hint={PARTNER_FAITH_OPTIONS[importance].hint}
            icon={PARTNER_FAITH_OPTIONS[importance].icon}
            selected={draft.partnerFaithImportance === importance}
            onPress={() => set({ partnerFaithImportance: importance })}
          />
        ))}
      </View>

      <View className="flex-row gap-3 rounded-2xl bg-sand p-4">
        <Icon name="check-circle-outline" size={18} color="verified" />
        <AppText tone="muted" className="flex-1 text-sm leading-5">
          We honour the high premium mature Nigerians place on domestic peace and spiritual harmony.
        </AppText>
      </View>
    </>
  );
}

function Location({ draft, set }: FormProps) {
  const [picking, setPicking] = useState(false);
  return (
    <>
      <Heading title="Where you live" subtitle="So distance doesn’t waste anyone’s time." />
      <View className="gap-2">
        <AppText weight="bold" tone="muted" className="text-[11px] tracking-wider">
          CURRENT RESIDENCE
        </AppText>
        <View className="flex-row items-center gap-3 rounded-2xl bg-white p-4">
          <View className="h-11 w-11 items-center justify-center rounded-full bg-sand">
            <Icon name="map-marker-outline" size={22} color="wine" />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-1.5">
              <AppText weight="bold" className="text-[20px]">
                {draft.city}
              </AppText>
              <Icon name="check-circle" size={16} color="verified" />
            </View>
            <AppText tone="muted" className="text-sm">
              Nigeria
            </AppText>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Change city" hitSlop={10} onPress={() => setPicking(true)}>
            <AppText weight="semibold" tone="wine" className="text-[15px]">
              Change
            </AppText>
          </Pressable>
        </View>
      </View>

      <View className="gap-3" accessibilityRole="radiogroup">
        <View className="gap-1">
          <AppText weight="bold" tone="muted" className="text-[11px] tracking-wider">
            INTENTIONAL ALIGNMENT
          </AppText>
          <Question title="Would you relocate for the right person?" large />
        </View>
        {keys<YesMaybeNo>(LABELS.relocate).map((option) => (
          <ChoiceCard
            key={option}
            label={LABELS.relocate[option]}
            hint={option === "maybe" ? "Open to interstate or diaspora moves" : undefined}
            selected={draft.relocate === option}
            onPress={() => set({ relocate: option })}
            radioLeft
          />
        ))}
      </View>

      <InfoCard icon="lock" title="Privacy First">
        Your exact neighborhood or street address is never requested or shared. We use your city to suggest people near
        you.
      </InfoCard>

      <CityPickerModal
        visible={picking}
        value={draft.city}
        onClose={() => setPicking(false)}
        onChoose={(city) => {
          set({ city });
          setPicking(false);
        }}
      />
    </>
  );
}

function Work({ draft, set }: FormProps) {
  return (
    <>
      <Heading title="Work and daily life" subtitle="Share the rhythm of your day and what keeps you purposeful." />
      <View className="gap-2">
        <Question
          title="Profession or occupation"
          right={
            <AppText weight="semibold" tone="muted" className="text-xs">
              Visible on profile
            </AppText>
          }
        />
        <View className="min-h-[56px] flex-row items-center gap-3 rounded-2xl bg-white px-4">
          <Icon name="briefcase-outline" size={20} color="inkMuted" />
          <TextInput
            accessibilityLabel="Profession or occupation"
            value={draft.occupation ?? ""}
            onChangeText={(occupation) => set({ occupation })}
            placeholder="e.g. Pharmacist, Runs a fashion business"
            placeholderTextColor={colors.inkFaint}
            maxLength={80}
            className="min-h-[56px] flex-1 font-body text-base text-ink"
            style={noWebFocusRing}
          />
        </View>
      </View>
      <View className="gap-2">
        <Question
          title="Describe a typical week"
          right={
            <AppText weight="semibold" tone="muted" className="text-xs">
              Narrative cadence
            </AppText>
          }
        />
        <TextBox
          accessibilityLabel="Describe a typical week"
          value={draft.typicalWeek ?? ""}
          onChangeText={(typicalWeek) => set({ typicalWeek })}
          max={MAX_TYPICAL_WEEK}
          goodNote="Thoughtfully detailed"
          placeholder="Weekdays at the pharmacy, Saturdays at the market, Sundays with family and church…"
        />
      </View>
      <InfoCard icon="lightbulb-outline" iconColor="wine" title="Respectful Authenticity">
        Members appreciate authentic glimpses into real day-to-day balance.
      </InfoCard>
    </>
  );
}

function LookingForForm({ draft, set }: FormProps) {
  return (
    <>
      <Heading title="What you’re looking for" subtitle="Clear intentions from the start." />
      <View className="gap-3" accessibilityRole="radiogroup">
        <Question
          title="Relationship intention"
          help="Select the primary nature of the union you seek at this stage of life."
          large
          right={
            <View className="flex-row items-center gap-1 rounded-full bg-verified-soft px-2.5 py-1">
              <Icon name="lock-outline" size={12} color="verified" />
              <AppText weight="bold" tone="verified" className="text-[11px]">
                Required
              </AppText>
            </View>
          }
        />
        {keys<LookingFor>(LABELS.lookingFor).map((option) => (
          <ChoiceCard
            key={option}
            label={LABELS.lookingFor[option]}
            hint={LOOKING_FOR_OPTIONS[option].hint}
            icon={LOOKING_FOR_OPTIONS[option].icon}
            selected={draft.lookingFor === option}
            onPress={() => set({ lookingFor: option })}
          />
        ))}
      </View>
      <View className="gap-3">
        <View className="gap-1">
          <View className="flex-row items-center gap-2">
            <Icon name="pencil-outline" size={18} color="wine" />
            <AppText weight="bold" className="text-[20px] leading-7">
              In your own words
            </AppText>
          </View>
          <AppText tone="muted" className="text-sm leading-5">
            What does a fulfilling partnership look like to you?
          </AppText>
        </View>
        <TextBox
          accessibilityLabel="In your own words"
          value={draft.ownWords ?? ""}
          onChangeText={(ownWords) => set({ ownWords })}
          max={MAX_OWN_WORDS}
          goodNote="Respectful Expression"
          placeholder="A kind, steady partner to build a calm, shared life with…"
        />
      </View>
      <InfoCard icon="eye-outline" iconColor="wine" title="Prominent Profile Display">
        Your words will be highlighted prominently on your profile for prospective matches to read with deliberate care.
      </InfoCard>
    </>
  );
}

const FORMS: Record<ProfileSection, (props: FormProps) => React.JSX.Element> = {
  "marital-history": MaritalHistory,
  children: Children,
  faith: FaithForm,
  location: Location,
  work: Work,
  "looking-for": LookingForForm,
};

export function SectionForm({ section, ...props }: FormProps & { section: ProfileSection }) {
  const Form = FORMS[section];
  return <Form {...props} />;
}
