import { useEffect, useState } from "react";
import { AppState, View } from "react-native";

import { AppText, Button, Icon, Screen, type IconName } from "@/shared/ui";

import { useSession } from "../session/SessionProvider";

const SUGGESTIONS: { icon: IconName; title: string; body: string }[] = [
  { icon: "wifi", title: "Connection Status", body: "Ensure mobile data or Wi-Fi is enabled on your device." },
  {
    icon: "sim-outline",
    title: "Network Balance",
    body: "If you are on MTN, Airtel, Glo or 9mobile, confirm data balance.",
  },
];

const QUICK_FIXES: { icon: IconName; title: string; body: string }[] = [
  { icon: "airplane", title: "Airplane Mode", body: "Toggle off and on" },
  { icon: "swap-horizontal", title: "Switch networks", body: "Try Wi-Fi or mobile data" },
];

/**
 * Shown at launch when a signed-in member's session can't be checked because the server is
 * unreachable. Retries on "Try again", and on its own whenever the app comes back to the foreground.
 */
export function UnreachableScreen() {
  const { refresh } = useSession();
  const [trying, setTrying] = useState(false);
  const [attempts, setAttempts] = useState(0);

  async function retry() {
    setTrying(true);
    // On success the session moves on and this screen goes away; otherwise we say it's still failing.
    await refresh();
    setTrying(false);
    setAttempts((count) => count + 1);
  }

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  return (
    <Screen safeTop>
      <View className="items-center">
        <View className="flex-row items-center gap-1.5 rounded-full bg-sand px-3 py-1">
          <View className="h-1.5 w-1.5 rounded-full bg-ink-muted" />
          <AppText weight="bold" tone="muted" className="text-[11px] tracking-wider">
            OFFLINE MODE
          </AppText>
        </View>
      </View>

      <View className="items-center gap-2">
        <View className="h-24 w-24 items-center justify-center rounded-full bg-sand">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-sand-dark">
            <Icon name="cloud-off-outline" size={30} color="wine" />
          </View>
          <View className="absolute bottom-1 right-1 h-7 w-7 items-center justify-center rounded-lg bg-white">
            <Icon name="signal-off" size={14} color="inkMuted" />
          </View>
        </View>
        <AppText weight="bold" className="text-center text-[26px] leading-8">
          Can’t reach icecream
        </AppText>
        <AppText tone="muted" className="text-center text-[16px] leading-6">
          {attempts > 0 && !trying
            ? "Still can’t connect. Check your Wi-Fi or mobile data is on, then try again."
            : "Check your connection and try again."}
        </AppText>
      </View>

      <View className="gap-4 rounded-2xl bg-white p-4">
        <View className="flex-row items-center gap-2">
          <Icon name="shield-check-outline" size={16} color="verified" />
          <AppText weight="bold" className="text-xs tracking-wider">
            HELPFUL SUGGESTIONS
          </AppText>
        </View>
        {SUGGESTIONS.map((item) => (
          <View key={item.title} className="flex-row gap-3">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-wine-soft">
              <Icon name={item.icon} size={16} color="wine" />
            </View>
            <View className="flex-1">
              <AppText weight="bold" className="text-[15px]">
                {item.title}
              </AppText>
              <AppText tone="muted" className="text-sm leading-5">
                {item.body}
              </AppText>
            </View>
          </View>
        ))}
        <View className="flex-row items-center gap-2 rounded-xl bg-sand px-3 py-2.5">
          <Icon name="lock-outline" size={14} color="inkMuted" />
          <AppText weight="semibold" tone="muted" className="flex-1 text-xs">
            Your session is safe. We’ll reconnect when you’re back online.
          </AppText>
        </View>
      </View>

      <View className="flex-row gap-3">
        {QUICK_FIXES.map((item) => (
          <View key={item.title} className="flex-1 items-center gap-1.5 rounded-2xl bg-white p-4">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-sand">
              <Icon name={item.icon} size={18} color="wine" />
            </View>
            <AppText weight="bold" className="text-center text-sm">
              {item.title}
            </AppText>
            <AppText tone="muted" className="text-center text-xs">
              {item.body}
            </AppText>
          </View>
        ))}
      </View>

      <Button
        label={trying ? "Trying…" : "Try again"}
        leadingIcon={trying ? undefined : "refresh"}
        disabled={trying}
        onPress={() => void retry()}
      />
    </Screen>
  );
}
