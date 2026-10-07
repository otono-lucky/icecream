import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";

import { memberPhotoPath } from "@/shared/lib/apiPaths";
import { useAsync } from "@/shared/lib/useAsync";
import { routes } from "@/shared/navigation/routes";
import { AppText, AuthImage, ErrorBanner, Icon, Screen } from "@/shared/ui";

import { getConversations } from "../api/messagingApi";
import { formatSentAt } from "../format";

export function ConversationsScreen() {
  const [reloadKey, setReloadKey] = useState(0);
  const conversations = useAsync(getConversations, [reloadKey]);
  // Refresh whenever the tab comes back into view (new messages, read counts).
  useFocusEffect(useCallback(() => setReloadKey((key) => key + 1), []));
  const list = conversations.data?.conversations ?? [];

  return (
    <Screen safeTop title="Messages">
      {conversations.status === "error" ? (
        <ErrorBanner message="Couldn’t load your messages. Check your connection and try again." />
      ) : null}
      {conversations.status === "success" && list.length === 0 ? (
        <View className="items-center gap-3 rounded-2xl bg-sand p-8">
          <Icon name="message-outline" size={30} color="wine" />
          <AppText weight="bold" className="text-center text-lg">
            No conversations yet
          </AppText>
          <AppText tone="muted" className="text-center text-[15px] leading-6">
            Tap Message on someone’s profile to start one.
          </AppText>
        </View>
      ) : null}
      <View className="gap-2">
        {list.map(({ member, lastMessage, unread }) => (
          <Pressable
            key={member.id}
            accessibilityRole="button"
            onPress={() => router.push(routes.chat(member.id))}
            className="flex-row items-center gap-3 rounded-2xl bg-white p-3 active:bg-sand"
          >
            <View className="h-14 w-14 overflow-hidden rounded-full bg-sand">
              {member.mainPhotoId ? (
                <AuthImage path={memberPhotoPath(member.id, member.mainPhotoId)} className="h-full w-full" />
              ) : null}
            </View>
            <View className="flex-1 gap-0.5">
              <View className="flex-row items-center justify-between gap-2">
                <AppText weight="bold" className="flex-1 text-base" numberOfLines={1}>
                  {member.firstName}
                </AppText>
                <AppText tone={unread ? "wine" : "faint"} weight={unread ? "bold" : "regular"} className="text-xs">
                  {formatSentAt(lastMessage.sentAt)}
                </AppText>
              </View>
              <View className="flex-row items-center gap-2">
                <AppText tone={unread ? "ink" : "muted"} weight={unread ? "semibold" : "regular"} className="flex-1 text-sm" numberOfLines={1}>
                  {lastMessage.fromMe ? "You: " : ""}
                  {lastMessage.text}
                </AppText>
                {unread ? (
                  <View className="h-5 min-w-[20px] items-center justify-center rounded-full bg-wine px-1.5">
                    <AppText weight="bold" tone="white" className="text-[11px]">
                      {unread}
                    </AppText>
                  </View>
                ) : null}
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
