import { MIN_AGE } from "@contracts";
import { LinearGradient } from "expo-linear-gradient";
import { Image, Pressable, View } from "react-native";

import { useSession } from "@/features/auth";
import { AppText, Button, Icon, Screen } from "@/shared/ui";

import { NOT_ELIGIBLE_IMAGE } from "../images";

export function NotEligibleScreen() {
  const { signOut } = useSession();

  return (
    <Screen safeTop>
      <View className="items-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={signOut}
          className="h-9 w-9 items-center justify-center rounded-full bg-sand"
        >
          <Icon name="close" size={18} color="inkMuted" />
        </Pressable>
      </View>

      <View className="items-center gap-3">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-sand">
          <Icon name="timer-sand" size={30} color="wine" />
          <View className="absolute bottom-0.5 right-0.5 h-6 w-6 items-center justify-center rounded-full border-2 border-ivory bg-verified">
            <Icon name="shield-outline" size={12} color="white" />
          </View>
        </View>
        <AppText weight="bold" className="text-center text-[26px] leading-8">
          Thank you for your interest
        </AppText>
        <AppText tone="muted" className="text-center text-[17px] leading-6">
          icecream is for members aged {MIN_AGE} and over, so we can’t create an account for you right now. We’d be
          glad to welcome you when the time comes.
        </AppText>
      </View>

      <View className="flex-row gap-3 rounded-2xl bg-sand p-4">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-verified-soft">
          <Icon name="shield-check-outline" size={18} color="verified" />
        </View>
        <View className="flex-1 gap-1">
          <AppText weight="bold" tone="verified" className="text-xs tracking-wider">
            OUR COMMITMENT
          </AppText>
          <AppText className="text-[15px] leading-5">
            Our age threshold protects the intentional focus of our mature community.
          </AppText>
        </View>
      </View>

      <View className="gap-2 rounded-2xl bg-sand p-3">
        <View className="flex-row items-center gap-2 px-1">
          <Icon name="star-four-points-outline" size={16} color="wine" />
          <AppText weight="bold" className="text-sm">
            Curated for life’s prime chapters
          </AppText>
        </View>
        <View className="h-36 overflow-hidden rounded-xl bg-charcoal">
          {NOT_ELIGIBLE_IMAGE ? (
            <Image source={NOT_ELIGIBLE_IMAGE} className="absolute h-full w-full" resizeMode="cover" />
          ) : null}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.65)"]}
            locations={[0.45, 1]}
            style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
          />
          <AppText weight="bold" tone="white" className="absolute bottom-3 left-3 text-sm">
            Dignity, Discretion & True Alignment
          </AppText>
        </View>
      </View>

      <View className="gap-1 rounded-2xl bg-sand p-4">
        <View className="flex-row items-center gap-2">
          <Icon name="calendar-blank-outline" size={16} color="ink" />
          <AppText weight="bold" className="text-base">
            Looking Ahead
          </AppText>
        </View>
        <AppText className="text-[15px] leading-5">
          Your stage in life is uniquely valuable. We look forward to meeting you on this side of thirty-five.
        </AppText>
      </View>

      <Button label="Close" variant="dark" onPress={signOut} />
    </Screen>
  );
}
