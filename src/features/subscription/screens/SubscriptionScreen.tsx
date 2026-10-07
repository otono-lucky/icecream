import { PLANS } from "@contracts";
import { useState } from "react";
import { Alert, Platform, View } from "react-native";

import { errorMessage } from "@/shared/lib/apiClient";
import { AppText, Button, Card, ErrorBanner, Screen } from "@/shared/ui";

import { cancelSubscription } from "../api/billingApi";
import { formatDate, formatNaira } from "../format";
import { useSubscription } from "../SubscriptionProvider";

export function SubscriptionScreen() {
  const { billing, setBilling } = useSubscription();
  const [error, setError] = useState<string>();
  const sub = billing?.subscription;
  // The server says "subscribed" while a paid period is running (even after cancelling).
  const live = billing?.why === "subscribed";

  async function cancel() {
    setError(undefined);
    try {
      setBilling(await cancelSubscription());
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function confirmCancel() {
    const message = `You can keep messaging until ${formatDate(sub!.currentPeriodEnd)}. It won’t renew after that.`;
    if (Platform.OS === "web") return void cancel();
    Alert.alert("Cancel your plan?", message, [
      { text: "Keep my plan", style: "cancel" },
      { text: "Cancel plan", style: "destructive", onPress: () => void cancel() },
    ]);
  }

  return (
    <Screen title="Subscription">
      {billing?.why === "free_at_launch" ? (
        <Card>
          <AppText weight="bold" className="text-base">
            Messaging is included
          </AppText>
          <AppText tone="muted" className="text-[15px]">
            You can message members without a plan.
          </AppText>
        </Card>
      ) : null}
      {sub && live ? (
        <Card>
          <AppText weight="bold" className="text-lg">
            {PLANS[sub.plan].label} plan
          </AppText>
          <AppText tone="muted" className="text-[15px]">
            {formatNaira(PLANS[sub.plan].priceNaira)} per {PLANS[sub.plan].per}
          </AppText>
          <View className="pt-1">
            <AppText className="text-[15px]">
              {sub.status === "active"
                ? `Renews on ${formatDate(sub.currentPeriodEnd)}`
                : `Cancelled. Messaging works until ${formatDate(sub.currentPeriodEnd)}.`}
            </AppText>
          </View>
        </Card>
      ) : billing?.why !== "free_at_launch" ? (
        <Card>
          <AppText weight="bold" className="text-base">
            No active plan
          </AppText>
          <AppText tone="muted" className="text-[15px]">
            Tap Message on someone’s profile to choose a plan.
          </AppText>
        </Card>
      ) : null}
      {error ? <ErrorBanner message={error} /> : null}
      {sub && live && sub.status === "active" ? (
        <Button label="Cancel plan" variant="secondary" onPress={confirmCancel} />
      ) : null}
    </Screen>
  );
}
