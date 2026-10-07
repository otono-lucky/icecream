import { Pressable, View } from "react-native";

import { AppText } from "@/shared/ui";

// A short, warm set; the phone keyboard's own emoji button still has everything else.
const EMOJIS = [
  "😊", "😂", "🥰", "😍", "😘", "🤗", "😇", "🙂", "😉", "😁", "🤔", "😮",
  "😢", "🙏", "👍", "👏", "🙌", "💪", "❤️", "💕", "💖", "🌹", "💐", "🌸",
  "☀️", "🌙", "✨", "🎉", "🎂", "☕", "🍲", "🍷", "🎶", "📖", "⛪", "🕌",
];

export function EmojiPanel({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <View className="flex-row flex-wrap justify-between px-1 pb-1">
      {EMOJIS.map((emoji) => (
        <Pressable
          key={emoji}
          accessibilityRole="button"
          accessibilityLabel={`Insert ${emoji}`}
          onPress={() => onPick(emoji)}
          className="h-11 w-[12.5%] items-center justify-center rounded-lg active:bg-sand"
        >
          <AppText className="text-2xl">{emoji}</AppText>
        </Pressable>
      ))}
    </View>
  );
}
