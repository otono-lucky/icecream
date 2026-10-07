import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthImage, Icon } from "@/shared/ui";

/** Full-screen view of a chat photo, whole and uncropped. */
export function PhotoViewer({ path, onClose }: { path: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={Boolean(path)} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black">
        {path ? <AuthImage path={path} contentFit="contain" className="h-full w-full" /> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close photo"
          onPress={onClose}
          className="absolute right-4 h-11 w-11 items-center justify-center rounded-full bg-white/20"
          style={{ top: insets.top + 8 }}
        >
          <Icon name="close" size={24} color="white" />
        </Pressable>
      </View>
    </Modal>
  );
}
