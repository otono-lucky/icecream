import { Text } from "react-native";

import { Card, Screen } from "@/shared/ui";

export function PrivacyScreen() {
  return (
    <Screen title="Privacy">
      <Card>
        {/* TODO: who can see my profile and photos; hide my profile from specific people (PRD §4.7). */}
        <Text className="text-neutral-500">Privacy controls go here.</Text>
      </Card>
    </Screen>
  );
}
