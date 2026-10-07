import { useState, type ReactNode } from "react";
import { FlatList, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

import { AuthImage } from "./AuthImage";

type PhotoCarouselProps = {
  /** API paths of the photos, in order. */
  paths: string[];
  /** Drawn over the photos (name, badges), and not swiped with them. */
  children?: ReactNode;
};

/** Swipe left and right through a member's photos. Bars at the top show how many there are. */
export function PhotoCarousel({ paths, children }: PhotoCarouselProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [index, setIndex] = useState(0);
  const { width, height } = size;

  // Each photo is sized to the carousel exactly; percentage heights collapse inside a horizontal list.
  const onLayout = (event: LayoutChangeEvent) =>
    setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height });
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width) setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <View className="flex-1 overflow-hidden bg-sand" onLayout={onLayout}>
      {width > 0 && height > 0 ? (
        <FlatList
          data={paths}
          keyExtractor={(path) => path}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={32}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          renderItem={({ item }) => (
            // The whole photo, never cropped (full-length portraits would lose heads), over a blurred
            // copy of itself so there are no empty bars at the sides.
            <View style={{ width, height }}>
              <AuthImage
                path={item}
                style={{ position: "absolute", width, height }}
                blurRadius={40}
              />
              <AuthImage path={item} style={{ width, height }} contentFit="contain" />
            </View>
          )}
        />
      ) : null}
      {paths.length > 1 ? (
        <View pointerEvents="none" className="absolute left-3 right-3 top-3 flex-row gap-1.5">
          {paths.map((path, i) => (
            <View key={path} className={`h-1 flex-1 rounded-full ${i === index ? "bg-white" : "bg-white/40"}`} />
          ))}
        </View>
      ) : null}
      {children}
    </View>
  );
}
