import { normalizeEmail, PLAN_ORDER, PLANS, type PlanId } from "@contracts";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { useMe } from "@/features/auth";
import { errorMessage } from "@/shared/lib/apiClient";
import { routes } from "@/shared/navigation/routes";
import { AppText, Button, ErrorBanner, Field, Icon, Screen } from "@/shared/ui";

import { startCheckout, verifyPayment } from "../api/billingApi";
import { formatNaira } from "../format";
import { useSubscription } from "../SubscriptionProvider";

const INCLUDES = ["Message any verified member", "Read and reply to every message", "Cancel any time from Settings"];

/** Shown on top of a member's profile the first time you tap Message (PRD 3.4), never while browsing. */
export function PaywallScreen() {
  const { memberId, memberName } = useLocalSearchParams<{ memberId: string; memberName: string }>();
  const me = useMe();
  const { setBilling } = useSubscription();
  const [plan, setPlan] = useState<PlanId>("monthly");
  const [email, setEmail] = useState("");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string>();
  const needsEmail = !me.user.email;
  const emailOk = !needsEmail || Boolean(normalizeEmail(email));
  const yearlySaving = Math.round((1 - PLANS.yearly.priceNaira / (PLANS.monthly.priceNaira * 12)) * 100);

  async function handlePay() {
    setPaying(true);
    setError(undefined);
    try {
      // If returning restarts the app (it can in Expo Go), billing-return finishes the job with these.
      const returnUrl = Linking.createURL("billing-return", { queryParams: { memberId, memberName } });
      const checkout = await startCheckout({ plan, email: needsEmail ? email : undefined, returnUrl });
      // The payment page opens inside the app; when it closes we ask the server whether it went through.
      await WebBrowser.openAuthSessionAsync(checkout.checkoutUrl, returnUrl);
      const result = await verifyPayment(checkout.reference);
      setBilling(result.billing);
      if (result.status === "paid") {
        // Drop the member straight into the chat they were starting (PRD 4.4).
        router.dismiss();
        router.push(routes.chat(memberId));
      } else {
        setError("Payment wasn’t completed. You haven’t been charged.");
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPaying(false);
    }
  }

  return (
    <Screen title={`Start talking to ${memberName}`} subtitle="Choose a plan to send messages. Browsing stays free.">
      <View className="gap-3">
        {PLAN_ORDER.map((id) => {
          const option = PLANS[id];
          const selected = plan === id;
          return (
            <Pressable
              key={id}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => setPlan(id)}
              className={`flex-row items-center gap-3 rounded-2xl p-4 ${selected ? "border-2 border-wine bg-white" : "border-2 border-transparent bg-sand"}`}
            >
              <View className="flex-1 gap-0.5">
                <View className="flex-row items-center gap-2">
                  <AppText weight="bold" className="text-base">
                    {option.label}
                  </AppText>
                  {id === "monthly" ? (
                    <View className="rounded-full bg-wine-soft px-2 py-0.5">
                      <AppText weight="bold" tone="wine" className="text-[11px]">
                        Popular
                      </AppText>
                    </View>
                  ) : null}
                  {id === "yearly" && yearlySaving > 0 ? (
                    <View className="rounded-full bg-verified-soft px-2 py-0.5">
                      <AppText weight="bold" tone="verified" className="text-[11px]">
                        Save {yearlySaving}%
                      </AppText>
                    </View>
                  ) : null}
                </View>
                <AppText tone="muted" className="text-sm">
                  {formatNaira(option.priceNaira)} per {option.per}
                </AppText>
              </View>
              {selected ? <Icon name="check-circle" size={24} color="wine" /> : <View className="h-5 w-5 rounded-full bg-sand-dark" />}
            </Pressable>
          );
        })}
      </View>

      <View className="gap-2 rounded-2xl bg-white p-4">
        {INCLUDES.map((line) => (
          <View key={line} className="flex-row items-center gap-2.5">
            <Icon name="check" size={16} color="verified" />
            <AppText className="text-[15px]">{line}</AppText>
          </View>
        ))}
        <AppText tone="muted" className="pt-1 text-xs">
          Renews automatically every {PLANS[plan].per} until you cancel.
        </AppText>
      </View>

      {needsEmail ? (
        <Field
          label="Email for your receipt"
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
        />
      ) : null}

      {error ? <ErrorBanner message={error} /> : null}
      <View className="gap-1">
        <Button
          label={paying ? "Opening secure checkout…" : `Pay ${formatNaira(PLANS[plan].priceNaira)}`}
          leadingIcon={paying ? undefined : "lock-outline"}
          disabled={paying || !emailOk}
          onPress={() => void handlePay()}
        />
        <AppText tone="muted" className="text-center text-xs">
          Card or bank transfer, through Paystack.
        </AppText>
        <Button label="Not now" variant="text" disabled={paying} onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
