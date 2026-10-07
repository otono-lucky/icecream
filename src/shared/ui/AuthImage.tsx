import { Image as ExpoImage } from "expo-image";
import { cssInterop } from "nativewind";
import { useEffect, useState } from "react";
import { Image, Platform, View, type StyleProp, type ImageStyle } from "react-native";

import { apiUrl, authHeaders } from "@/shared/lib/apiClient";

// Let NativeWind classes style expo-image like a built-in component.
cssInterop(ExpoImage, { className: "style" });

type AuthImageProps = {
  /** API path of an image that needs the member's session, e.g. /v1/me/photos/:id. */
  path: string;
  className?: string;
  style?: StyleProp<ImageStyle>;
  /** "cover" fills the frame (may crop); "contain" shows the whole image. */
  contentFit?: "cover" | "contain";
  blurRadius?: number;
};

/**
 * An image served by our API behind the session token.
 * - Native: expo-image, which sends the Authorization header (React Native's <Image> doesn't on Android)
 *   and caches the result on disk.
 * - Web: browsers can't add headers to <img>, so we fetch it and show a local object URL.
 */
export function AuthImage({ path, className, style, contentFit = "cover", blurRadius }: AuthImageProps) {
  const [webUri, setWebUri] = useState<string>();

  useEffect(() => {
    if (Platform.OS !== "web") return;
    let objectUrl: string | undefined;
    let cancelled = false;
    void fetch(apiUrl(path), { headers: authHeaders() })
      .then((response) => (response.ok ? response.blob() : undefined))
      .then((blob) => {
        if (!blob || cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setWebUri(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (Platform.OS === "web") {
    return webUri ? (
      <Image source={{ uri: webUri }} className={className} style={style} resizeMode={contentFit} blurRadius={blurRadius} />
    ) : (
      <View className={className} style={style} />
    );
  }
  return (
    <ExpoImage
      source={{ uri: apiUrl(path), headers: authHeaders(), cacheKey: path }}
      className={className}
      style={style}
      contentFit={contentFit}
      blurRadius={blurRadius}
      cachePolicy="memory-disk"
      transition={150}
    />
  );
}
