import "../global.css";

import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

import { UnreachableScreen, useSession } from "@/features/auth";
import { AppProviders } from "@/providers/AppProviders";

// Keep the splash up while the saved session is restored, so returning members never see sign-in flash by.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}

/**
 * One of (app), (onboarding) and (public) is reachable at a time. When the session status changes, Expo
 * Router redirects to the first reachable group. (profile) is listed after them so it's never that
 * first group, and stays reachable when a pending member is approved.
 */
function RootNavigator() {
  const { status } = useSession();
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  // A font failure falls back to the system font rather than blocking the app.
  const ready = status !== "loading" && (fontsLoaded || fontError !== null);

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  if (!ready) return null;
  if (status === "unreachable") return <UnreachableScreen />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === "active"}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={status === "onboarding"}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={status === "signedOut"}>
        <Stack.Screen name="(public)" />
      </Stack.Protected>
      {/* Profile building and editing: while verification is pending, and after. */}
      <Stack.Protected guard={status === "onboarding" || status === "active"}>
        <Stack.Screen name="(profile)" />
      </Stack.Protected>
      {/* Landing page for the payment checkout's redirect back into the app. */}
      <Stack.Screen name="billing-return" />
    </Stack>
  );
}
