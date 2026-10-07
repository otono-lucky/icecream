import { Stack } from "expo-router";

// Welcome must stay first: signed-out members are redirected to the first screen declared here.
// Welcome, Sign in and Enter code draw their own headers (OnboardingHeader), per the designs.
export default function PublicLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FAF8F5" } }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="otp" />
    </Stack>
  );
}
