import type { Message } from "@contracts";
import { Pressable, View } from "react-native";

import { chatPhotoPath } from "@/shared/lib/apiPaths";
import { AppText, AuthImage, Icon } from "@/shared/ui";

import { formatSentAt } from "../format";

type MessageBubbleProps = {
  message: Message;
  memberId: string;
  memberName: string;
  /** Shown under your most recent message: "Sent" or "Seen". */
  receipt?: "Sent" | "Seen";
  revealed: boolean;
  onReveal: () => void;
  onOpenPhoto: (path: string) => void;
  onLongPress: () => void;
};

const PHOTO_SIZE = { width: 240, height: 300 };

export function MessageBubble({
  message,
  memberId,
  memberName,
  receipt,
  revealed,
  onReveal,
  onOpenPhoto,
  onLongPress,
}: MessageBubbleProps) {
  const { fromMe } = message;
  const bubble = fromMe ? "rounded-br-md bg-wine" : "rounded-bl-md bg-white";
  const textTone = fromMe ? "white" : "ink";
  const photoPath = chatPhotoPath(memberId, message.id);

  // Group the same emoji: "❤️ 2".
  const reactionCounts = message.reactions.reduce<Record<string, number>>((counts, reaction) => {
    counts[reaction.emoji] = (counts[reaction.emoji] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <View className={`max-w-[80%] gap-0.5 ${fromMe ? "items-end self-end" : "items-start self-start"}`}>
      {/* The bubble is a plain View; its parts are separate tap areas (never a button inside a button). */}
      <View
        className={`overflow-hidden rounded-2xl ${message.kind === "deleted" ? "border border-sand-dark bg-transparent" : bubble}`}
      >
        {message.replyTo ? (
          <Pressable onLongPress={onLongPress} delayLongPress={300}>
            <View
              className={`m-1.5 mb-0 rounded-xl border-l-4 px-3 py-1.5 ${fromMe ? "border-white/70 bg-white/15" : "border-wine bg-sand"}`}
            >
              <AppText weight="bold" tone={fromMe ? "white" : "wine"} className="text-xs">
                {message.replyTo.fromMe ? "You" : memberName}
              </AppText>
              <AppText tone={fromMe ? "white" : "muted"} className="text-[13px]" numberOfLines={2}>
                {message.replyTo.text}
              </AppText>
            </View>
          </Pressable>
        ) : null}

        {message.kind === "deleted" ? (
          <Pressable onLongPress={onLongPress} delayLongPress={300} className="flex-row items-center gap-1.5 px-4 py-2.5">
            <Icon name="cancel" size={14} color="inkFaint" />
            <AppText tone="faint" className="text-[15px] italic">
              {fromMe ? "You deleted this message" : "This message was deleted"}
            </AppText>
          </Pressable>
        ) : message.kind === "photo" ? (
          <View>
            {message.photo?.blurred && !revealed ? (
              // Safeguard: a photo from someone you haven't replied to stays blurred until you choose.
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Photo from ${memberName}. Tap to view`}
                onPress={onReveal}
                onLongPress={onLongPress}
                delayLongPress={300}
              >
                <AuthImage path={photoPath} blurRadius={60} style={PHOTO_SIZE} />
                <View pointerEvents="none" className="absolute inset-0 items-center justify-center gap-1 bg-black/30 p-4">
                  <Icon name="eye-outline" size={26} color="white" />
                  <AppText weight="bold" tone="white" className="text-center text-sm">
                    Photo from {memberName}
                  </AppText>
                  <AppText tone="white" className="text-center text-xs">
                    Tap to view
                  </AppText>
                </View>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="imagebutton"
                accessibilityLabel="Open photo"
                onPress={() => onOpenPhoto(photoPath)}
                onLongPress={onLongPress}
                delayLongPress={300}
              >
                <AuthImage path={photoPath} style={PHOTO_SIZE} />
              </Pressable>
            )}
            {message.body ? (
              <Pressable onLongPress={onLongPress} delayLongPress={300}>
                <AppText tone={textTone} className="px-3 py-2 text-[15px] leading-5">
                  {message.body}
                </AppText>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <Pressable
            accessibilityHint="Long-press for reactions, reply and delete"
            onLongPress={onLongPress}
            delayLongPress={300}
          >
            <AppText tone={textTone} className="px-4 py-2.5 text-[16px] leading-6">
              {message.body}
            </AppText>
          </Pressable>
        )}
      </View>

      {Object.keys(reactionCounts).length ? (
        <View className={`-mt-2 flex-row gap-1 ${fromMe ? "mr-2" : "ml-2"}`}>
          {Object.entries(reactionCounts).map(([emoji, count]) => (
            <View key={emoji} className="flex-row items-center rounded-full border border-sand-dark bg-white px-1.5 py-0.5">
              <AppText className="text-sm">{emoji}</AppText>
              {count > 1 ? (
                <AppText weight="semibold" tone="muted" className="text-xs">
                  {" "}
                  {count}
                </AppText>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <AppText tone="faint" className="text-[11px]">
        {formatSentAt(message.sentAt)}
        {receipt ? ` · ${receipt}` : ""}
      </AppText>
    </View>
  );
}
