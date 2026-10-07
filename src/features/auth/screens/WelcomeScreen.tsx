import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Image, View } from "react-native";

import { routes } from "@/shared/navigation/routes";
import { AppText, Button, Icon, Screen, Wordmark, type IconName } from "@/shared/ui";

import { WELCOME_HERO } from "../images";

const TRUST_POINTS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "shield-check-outline",
    title: "Every member is verified",
    body: "Every member passes a photo and selfie check before they can browse, keeping our community safe, honest, and accountable.",
  },
  {
    icon: "shield-outline",
    title: "Only people 35 and over",
    body: "Reserved solely for accomplished adults, divorcees, widows, and singles ready for enduring mutual respect.",
  },
  {
    icon: "eye-off-outline",
    title: "You decide who sees you",
    body: "Hide your profile from people you know, and pause it any time.",
  },
];

export function WelcomeScreen() {
  return (
    <Screen safeTop>
      <View className="flex-row items-center justify-between">
        <Wordmark />
        <View className="flex-row items-center gap-1.5 rounded-full bg-verified-soft px-3 py-1">
          <Icon name="shield-check" size={14} color="verified" />
          <AppText weight="bold" tone="verified" className="text-[11px] tracking-wider">
            PRIVATE REGISTRY
          </AppText>
        </View>
      </View>

      <View className="gap-2">
        <AppText weight="medium" className="text-[34px] leading-[40px]">
          Serious second chances.
        </AppText>
        <AppText tone="muted" className="text-[17px] leading-6">
          A verified community for single Nigerians over 35 who are ready for something real.
        </AppText>
      </View>

      <View className="h-48 overflow-hidden rounded-2xl bg-charcoal">
        {WELCOME_HERO ? <Image source={WELCOME_HERO} className="absolute h-full w-full" resizeMode="cover" /> : null}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.72)"]}
          locations={[0.35, 1]}
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
        />
        <View className="absolute bottom-0 left-0 right-0 flex-row items-end gap-3 p-4">
          <View className="flex-1 gap-0.5">
            <AppText weight="bold" tone="white" className="text-base">
              Curated Circle • Lagos & Abuja
            </AppText>
            <AppText tone="white" className="text-sm leading-5">
              Intentional courtship & mature companionship
            </AppText>
          </View>
          <View className="h-9 w-9 items-center justify-center rounded-full bg-white/20">
            <Icon name="lock-outline" size={18} color="white" />
          </View>
        </View>
      </View>

      <View className="gap-3">
        {TRUST_POINTS.map((point) => (
          <View key={point.title} className="flex-row gap-4 rounded-2xl bg-white p-4">
            <View className="h-10 w-10 items-center justify-center rounded-lg bg-sand">
              <Icon name={point.icon} size={20} color="wine" />
            </View>
            <View className="flex-1 gap-1">
              <AppText weight="semibold" className="text-base">
                {point.title}
              </AppText>
              <AppText tone="muted" className="text-sm leading-5">
                {point.body}
              </AppText>
            </View>
          </View>
        ))}
      </View>

      <View className="gap-2 pt-2">
        <Button label="Get started" trailingIcon="arrow-right" onPress={() => router.push(routes.signIn)} />
        <Button label="I already have an account" variant="text" onPress={() => router.push(routes.signIn)} />
      </View>
      <AppText tone="muted" className="text-center text-xs leading-5">
        Discreet. Rigorously vetted. Tailored for Nigerian professionals.
      </AppText>
    </Screen>
  );
}
