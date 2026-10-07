import { File } from "expo-file-system";
import type { ImagePickerAsset } from "expo-image-picker";
import { Platform } from "react-native";

/**
 * Adds a picked image to a multipart form in the shape each platform's fetch can send.
 *
 * On native, Expo's fetch (the global fetch since SDK 52) does not accept React Native's
 * `{ uri, name, type }` descriptors; it sends any part that has `bytes()`, and uses its
 * `name` and `type` for the filename and Content-Type. So we read the file ourselves.
 */
export async function appendImage(form: FormData, field: string, asset: ImagePickerAsset): Promise<void> {
  const type = asset.mimeType ?? "image/jpeg";
  const name = asset.fileName ?? `${field}.${type.split("/")[1] ?? "jpg"}`;

  if (Platform.OS === "web") {
    const blob = asset.file ?? (await (await fetch(asset.uri)).blob());
    form.append(field, blob, name);
    return;
  }

  const file = new File(asset.uri);
  const part = { name, type, bytes: () => file.bytes() };
  form.append(field, part as unknown as Blob);
}
