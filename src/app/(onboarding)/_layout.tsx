import { Stack } from "expo-router";

// `index` must stay first: when the session enters "onboarding", the root guard redirects to the
// first screen declared here, and index resumes at the step the server says is next.
// Every step draws its own OnboardingHeader (with a back arrow to the previous step), so no native headers.
export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FAF8F5" } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="age-gate" />
      <Stack.Screen name="basic-details" />
      <Stack.Screen name="photos" />
      <Stack.Screen name="liveness" />
      <Stack.Screen name="id-verification" />
      <Stack.Screen name="verification-pending" options={{ gestureEnabled: false }} />
      <Stack.Screen name="not-eligible" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
