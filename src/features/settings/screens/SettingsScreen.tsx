import { Link } from "expo-router";
import { Alert, View } from "react-native";

import { useSession } from "@/features/auth";
import { routes } from "@/shared/navigation/routes";
import { Button, Card, Screen } from "@/shared/ui";

export function SettingsScreen() {
  const { signOut } = useSession();

  function confirmDelete() {
    Alert.alert("Delete your account?", "Your profile, messages and data will be permanently removed.", [
      { text: "Cancel", style: "cancel" },
      // TODO: call the delete-account endpoint before signing out.
      { text: "Delete", style: "destructive", onPress: signOut },
    ]);
  }

  return (
    <Screen>
      <Card>
        <View className="gap-3">
          <Link href={routes.subscription} className="text-base text-neutral-900">
            Subscription
          </Link>
          <Link href={routes.paymentHistory} className="text-base text-neutral-900">
            Payment history
          </Link>
          <Link href={routes.privacy} className="text-base text-neutral-900">
            Privacy
          </Link>
        </View>
      </Card>
      {/* TODO: notification preferences, pause profile. */}
      <Button label="Sign out" variant="secondary" onPress={signOut} />
      <Button label="Delete account" variant="text" onPress={confirmDelete} />
    </Screen>
  );
}
