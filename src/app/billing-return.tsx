import { Redirect, router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { useSession } from "@/features/auth";
import { useSubscription } from "@/features/subscription";
import { routes } from "@/shared/navigation/routes";
import { colors } from "@/shared/ui";

// Where the payment page sends the member back to. Usually the paywall is still open and checks the
// payment itself; this closes the in-app browser (or web popup). If returning restarted the app
// (Expo Go can), the paywall is gone, so this checks the payment and opens the chat instead.
WebBrowser.maybeCompleteAuthSession();

export default function BillingReturn() {
  const { memberId, status } = useLocalSearchParams<{ memberId?: string; status?: string }>();
  const session = useSession();
  const { refresh } = useSubscription();

  useEffect(() => {
    if (session.status !== "active") return;
    void refresh().then((billing) => {
      router.replace("/");
      if (status === "paid" && billing?.canMessage && memberId) router.push(routes.chat(memberId));
    });
  }, [session.status, refresh, status, memberId]);

  if (session.status !== "active" && session.status !== "loading") return <Redirect href="/" />;
  return (
    <View className="flex-1 items-center justify-center bg-ivory">
      <ActivityIndicator color={colors.wine} />
    </View>
  );
}
