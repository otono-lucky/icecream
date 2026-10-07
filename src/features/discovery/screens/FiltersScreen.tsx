import { router } from "expo-router";
import { Text } from "react-native";

import { Button, Screen } from "@/shared/ui";

export function FiltersScreen() {
  return (
    <Screen title="Filters">
      {/* TODO: age, location, faith, marital history and children (DiscoveryFilters). */}
      <Text className="text-neutral-500">Filter controls go here.</Text>
      <Button label="Show results" onPress={() => router.back()} />
    </Screen>
  );
}
