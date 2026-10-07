import { MAX_MESSAGE_LENGTH, type ChatResponse, type Message, type Reaction } from "@contracts";
import * as ImagePicker from "expo-image-picker";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SafetyActions } from "@/features/safety";
import { useSubscription } from "@/features/subscription";
import { ApiError, errorMessage } from "@/shared/lib/apiClient";
import { routes } from "@/shared/navigation/routes";
import { AppText, Button, colors, ErrorBanner, Icon, noWebFocusRing } from "@/shared/ui";

import { deleteMessage, getChat, react, sendMessage, sendPhoto } from "../api/messagingApi";
import { EmojiPanel } from "../components/EmojiPanel";
import { MessageActions } from "../components/MessageActions";
import { MessageBubble } from "../components/MessageBubble";
import { PhotoViewer } from "../components/PhotoViewer";
import { dayLabel, sameDay } from "../format";

const POLL_MS = 3000;
// After this many messages, a gentle nudge toward a proper call (PRD 4.4).
const NUDGE_AFTER = 10;

function confirm(title: string, message: string, action: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: action, style: "destructive", onPress: onConfirm },
  ]);
}

export function ChatScreen() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const insets = useSafeAreaInsets();
  const { billing } = useSubscription();
  const [chat, setChat] = useState<ChatResponse>();
  const [pending, setPending] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState<"text" | "photo">();
  const [error, setError] = useState<string>();
  const [gone, setGone] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [actionsFor, setActionsFor] = useState<Message | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    try {
      setChat(await getChat(memberId));
      setPending([]);
    } catch (e) {
      // Blocked, or no longer verified: the profile isn't available any more.
      if (e instanceof ApiError && e.status === 404) setGone(true);
    }
  }, [memberId]);

  // Check for new messages every few seconds while the chat is on screen.
  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(() => void load(), POLL_MS);
      return () => clearInterval(timer);
    }, [load]),
  );

  const messages = [...(chat?.messages ?? []), ...pending.filter((p) => !chat?.messages.some((m) => m.id === p.id))];
  // Paying elsewhere (e.g. the paywall) updates billing; the next poll updates canSend too.
  const canSend = Boolean(chat?.canSend || billing?.canMessage);
  const name = chat?.member.firstName ?? "";
  const lastMine = [...messages].reverse().find((message) => message.fromMe && message.kind !== "deleted");

  useEffect(() => {
    scroll.current?.scrollToEnd({ animated: false });
  }, [messages.length]);

  async function run(kind: "text" | "photo", action: () => Promise<Message>) {
    setSending(kind);
    setError(undefined);
    try {
      const message = await action();
      setPending((current) => [...current, message]);
      setReplyTo(null);
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setSending(undefined);
    }
  }

  async function handleSend() {
    const body = draft.trim();
    if (!body) return;
    if (await run("text", () => sendMessage(memberId, body, replyTo?.id))) setDraft("");
  }

  async function handlePhoto() {
    setShowEmoji(false);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (result.canceled) return;
    await run("photo", () => sendPhoto(memberId, result.assets[0], replyTo?.id));
  }

  async function handleReact(message: Message, emoji: Reaction | null) {
    setActionsFor(null);
    try {
      await react(memberId, message.id, emoji);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function handleDelete(message: Message) {
    setActionsFor(null);
    confirm("Delete this message?", `It will be removed for you and ${name}.`, "Delete", () => {
      void deleteMessage(memberId, message.id)
        .then(load)
        .catch((e: unknown) => setError(errorMessage(e)));
    });
  }

  if (gone) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-ivory p-8">
        <Stack.Screen options={{ title: "" }} />
        <Icon name="account-off-outline" size={32} color="inkMuted" />
        <AppText tone="muted" className="text-center text-[15px]">
          This conversation is no longer available.
        </AppText>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-ivory"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <Stack.Screen options={{ title: name ? `${name}, ${chat!.member.age}` : "" }} />
      <ScrollView ref={scroll} className="flex-1" contentContainerClassName="gap-2 px-4 py-4" keyboardShouldPersistTaps="handled">
        {chat && messages.length === 0 ? (
          <View className="items-center gap-2 py-10">
            <Icon name="message-text-outline" size={28} color="wine" />
            <AppText tone="muted" className="text-center text-[15px]">
              Say hello to {name}. Keep it warm and genuine.
            </AppText>
          </View>
        ) : null}

        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const newDay = !previous || !sameDay(previous.sentAt, message.sentAt);
          const receipt =
            message.id === lastMine?.id
              ? chat?.theirLastReadAt && chat.theirLastReadAt >= message.sentAt
                ? "Seen"
                : "Sent"
              : undefined;
          return (
            <Fragment key={message.id}>
              {newDay ? (
                <View className="items-center py-2">
                  <View className="rounded-full bg-sand px-3 py-1">
                    <AppText weight="semibold" tone="muted" className="text-xs">
                      {dayLabel(message.sentAt)}
                    </AppText>
                  </View>
                </View>
              ) : null}
              <MessageBubble
                message={message}
                memberId={memberId}
                memberName={name}
                receipt={receipt}
                revealed={revealed.has(message.id)}
                onReveal={() => setRevealed((current) => new Set(current).add(message.id))}
                onOpenPhoto={setViewing}
                onLongPress={() => setActionsFor(message)}
              />
            </Fragment>
          );
        })}

        {messages.length >= NUDGE_AFTER ? (
          <View className="mt-2 flex-row items-center gap-2 rounded-xl bg-sand px-3 py-2.5">
            <Icon name="phone-outline" size={16} color="wine" />
            <AppText weight="semibold" className="flex-1 text-sm">
              Getting on well? Suggest a call when you’re both ready.
            </AppText>
          </View>
        ) : null}
        <View className="pt-4">
          <SafetyActions memberId={memberId} memberName={name} onBlocked={() => router.back()} />
        </View>
      </ScrollView>

      <View className="gap-2 border-t border-sand-dark bg-white px-3 pt-2" style={{ paddingBottom: insets.bottom + 8 }}>
        {error ? <ErrorBanner message={error} /> : null}
        {replyTo ? (
          <View className="flex-row items-center gap-2 rounded-xl border-l-4 border-wine bg-sand px-3 py-2">
            <View className="flex-1">
              <AppText weight="bold" tone="wine" className="text-xs">
                Replying to {replyTo.fromMe ? "yourself" : name}
              </AppText>
              <AppText tone="muted" className="text-[13px]" numberOfLines={1}>
                {replyTo.kind === "photo" ? `📷 ${replyTo.body || "Photo"}` : replyTo.body}
              </AppText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel reply" hitSlop={10} onPress={() => setReplyTo(null)}>
              <Icon name="close" size={18} color="inkMuted" />
            </Pressable>
          </View>
        ) : null}

        {!chat ? null : canSend ? (
          <>
            <View className="flex-row items-end gap-1.5">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showEmoji ? "Show keyboard" : "Emoji"}
                onPress={() => {
                  Keyboard.dismiss();
                  setShowEmoji((shown) => !shown);
                }}
                className="h-12 w-10 items-center justify-center"
              >
                <Icon name={showEmoji ? "keyboard-outline" : "emoticon-outline"} size={24} color="inkMuted" />
              </Pressable>
              <TextInput
                accessibilityLabel="Message"
                value={draft}
                onChangeText={setDraft}
                // Only a real tap on the box closes the emoji panel (focus can shift when the emoji button is tapped).
                onPressIn={() => setShowEmoji(false)}
                placeholder={`Message ${name}`}
                placeholderTextColor={colors.inkFaint}
                multiline
                maxLength={MAX_MESSAGE_LENGTH}
                className="max-h-32 min-h-[48px] flex-1 rounded-2xl bg-sand px-4 py-3 font-body text-base text-ink"
                style={noWebFocusRing}
              />
              {draft.trim() ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send"
                  disabled={Boolean(sending)}
                  onPress={() => void handleSend()}
                  className={`h-12 w-12 items-center justify-center rounded-full ${sending ? "bg-sand-dark" : "bg-wine"}`}
                >
                  <Icon name="send" size={20} color={sending ? "inkFaint" : "white"} />
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send a photo"
                  disabled={Boolean(sending)}
                  onPress={() => void handlePhoto()}
                  className="h-12 w-12 items-center justify-center rounded-full bg-sand"
                >
                  <Icon name={sending === "photo" ? "progress-upload" : "image-outline"} size={22} color="wine" />
                </Pressable>
              )}
            </View>
            {showEmoji ? <EmojiPanel onPick={(emoji) => setDraft((current) => current + emoji)} /> : null}
          </>
        ) : (
          <Button label="Choose a plan to reply" leadingIcon="lock-outline" onPress={() => router.push(routes.paywall(memberId, name))} />
        )}
      </View>

      <MessageActions
        message={actionsFor}
        canSend={canSend}
        onClose={() => setActionsFor(null)}
        onReact={(emoji) => actionsFor && void handleReact(actionsFor, emoji)}
        onReply={() => {
          setReplyTo(actionsFor);
          setActionsFor(null);
        }}
        onDelete={() => actionsFor && handleDelete(actionsFor)}
      />
      <PhotoViewer path={viewing} onClose={() => setViewing(null)} />
    </KeyboardAvoidingView>
  );
}
