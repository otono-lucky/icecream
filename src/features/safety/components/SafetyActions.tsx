import { router } from "expo-router";
import { Alert, Platform, View } from "react-native";

import { routes } from "@/shared/navigation/routes";
import { Button } from "@/shared/ui";

import { blockMember } from "../api/safetyApi";

type SafetyActionsProps = {
  memberId: string;
  memberName: string;
  onBlocked?: () => void;
};

/** Asks "Block …?" and blocks if confirmed. For a Block option outside SafetyActions (e.g. a menu). */
export function useConfirmBlock({ memberId, memberName, onBlocked }: SafetyActionsProps) {
  async function block() {
    await blockMember(memberId);
    onBlocked?.();
  }

  function confirmBlock() {
    const title = `Block ${memberName}?`;
    const message = "You won’t see each other anywhere, and they can’t message you. They aren’t told.";
    // Browsers have no native alert with buttons; use the standard confirm dialog there.
    if (Platform.OS === "web") {
      if (globalThis.confirm?.(`${title}\n\n${message}`)) void block();
      return;
    }
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: "Block", style: "destructive", onPress: () => void block() },
    ]);
  }

  return confirmBlock;
}

/** Report and block, available from every screen that shows another member (PRD §3.4). */
export function SafetyActions({ memberId, memberName, onBlocked }: SafetyActionsProps) {
  const confirmBlock = useConfirmBlock({ memberId, memberName, onBlocked });

  return (
    <View className="flex-row gap-2">
      <View className="flex-1">
        <Button label="Report" variant="text" onPress={() => router.push(routes.report(memberId))} />
      </View>
      <View className="flex-1">
        <Button label="Block" variant="text" onPress={confirmBlock} />
      </View>
    </View>
  );
}
