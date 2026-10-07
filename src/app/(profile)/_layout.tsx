import { Stack } from "expo-router";

// Profile screens, open both while verification is pending and once a member is in. They sit in
// their own group so approval arriving mid-way doesn't pull the member out of the screen they're on.
// Every screen draws its own top bar.
export default function ProfileLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FAF8F5" } }} />;
}
