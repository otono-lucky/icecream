import { Tabs } from "expo-router";

import { Icon, type IconName } from "@/shared/ui";
import { colors } from "@/shared/ui/theme";

function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return <Icon name={name} size={24} color={focused ? "wine" : "inkMuted"} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.wine,
        tabBarInactiveTintColor: colors.inkMuted,
        // Plus Jakarta's taller line height clips labels at the default size; pin it.
        tabBarLabelStyle: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 12, lineHeight: 16 },
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: "#E7E1DA" },
        headerTitleStyle: { fontFamily: "PlusJakartaSans_700Bold" },
        sceneStyle: { backgroundColor: colors.ivory },
      }}
    >
      {/* Today draws its own header, per the design. */}
      <Tabs.Screen name="index" options={{ title: "Today", headerShown: false, tabBarIcon: ({ focused }) => <TabIcon name="home-outline" focused={focused} /> }} />
      <Tabs.Screen name="interests" options={{ title: "Interests", tabBarIcon: ({ focused }) => <TabIcon name="heart-outline" focused={focused} /> }} />
      <Tabs.Screen name="messages" options={{ title: "Messages", headerShown: false, tabBarIcon: ({ focused }) => <TabIcon name="message-outline" focused={focused} /> }} />
      <Tabs.Screen name="me" options={{ title: "Me", headerShown: false, tabBarIcon: ({ focused }) => <TabIcon name="account-outline" focused={focused} /> }} />
    </Tabs>
  );
}
