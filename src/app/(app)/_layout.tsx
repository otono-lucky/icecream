import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="member/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="chat/[memberId]" options={{ title: "Chat" }} />
      <Stack.Screen name="filters" options={{ presentation: "modal", title: "Filters" }} />
      <Stack.Screen name="paywall" options={{ presentation: "modal", title: "" }} />
      <Stack.Screen name="report" options={{ presentation: "modal", title: "Report" }} />
      <Stack.Screen name="settings/index" options={{ title: "Settings" }} />
      <Stack.Screen name="settings/subscription" options={{ title: "Subscription" }} />
      <Stack.Screen name="settings/payment-history" options={{ title: "Payment history" }} />
      <Stack.Screen name="settings/privacy" options={{ title: "Privacy" }} />
    </Stack>
  );
}
