import { REACTIONS, type Message, type Reaction } from "@contracts";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Icon, type IconName } from "@/shared/ui";

type MessageActionsProps = {
  message: Message | null;
  canSend: boolean;
  onClose: () => void;
  onReact: (emoji: Reaction | null) => void;
  onReply: () => void;
  onDelete: () => void;
};

function Row({ icon, label, tone, onPress }: { icon: IconName; label: string; tone?: "danger"; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="flex-row items-center gap-3 px-5 py-4 active:bg-sand">
      <Icon name={icon} size={20} color={tone === "danger" ? "danger" : "ink"} />
      <AppText weight="semibold" tone={tone === "danger" ? "danger" : "ink"} className="text-base">
        {label}
      </AppText>
    </Pressable>
  );
}

/** Long-press menu on a message: react, reply, or delete (your own). */
export function MessageActions({ message, canSend, onClose, onReact, onReply, onDelete }: MessageActionsProps) {
  const insets = useSafeAreaInsets();
  const mine = message?.reactions.find((reaction) => reaction.fromMe)?.emoji ?? null;

  return (
    <Modal visible={Boolean(message)} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" onPress={onClose} className="flex-1 bg-black/40" />
      <View className="rounded-t-3xl bg-white pt-4" style={{ paddingBottom: insets.bottom + 8 }}>
        {canSend && message?.kind !== "deleted" ? (
          <View className="flex-row justify-around px-4 pb-3">
            {REACTIONS.map((emoji) => (
              <Pressable
                key={emoji}
                accessibilityRole="button"
                accessibilityLabel={mine === emoji ? `Remove ${emoji}` : `React ${emoji}`}
                onPress={() => onReact(mine === emoji ? null : emoji)}
                className={`h-12 w-12 items-center justify-center rounded-full ${mine === emoji ? "bg-wine-soft" : "bg-sand"}`}
              >
                <AppText className="text-2xl">{emoji}</AppText>
              </Pressable>
            ))}
          </View>
        ) : null}
        {canSend && message?.kind !== "deleted" ? <Row icon="reply-outline" label="Reply" onPress={onReply} /> : null}
        {message?.fromMe && message.kind !== "deleted" ? (
          <Row icon="trash-can-outline" label="Delete for everyone" tone="danger" onPress={onDelete} />
        ) : null}
        <Row icon="close" label="Cancel" onPress={onClose} />
      </View>
    </Modal>
  );
}
