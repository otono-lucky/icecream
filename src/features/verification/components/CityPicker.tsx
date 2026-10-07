import { useState } from "react";
import { FlatList, Modal, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, colors, Icon, noWebFocusRing } from "@/shared/ui";

import { NIGERIAN_CITIES, POPULAR_CITIES } from "../nigerianCities";

type CityPickerProps = { value: string; onChange: (city: string) => void };

/** The City field from the About you design: a dropdown with search, plus "Popular" quick picks. */
export function CityPicker({ value, onChange }: CityPickerProps) {
  const [open, setOpen] = useState(false);

  function choose(city: string) {
    onChange(city);
    setOpen(false);
  }

  return (
    <View className="gap-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`City: ${value || "choose"}`}
        onPress={() => setOpen(true)}
        className="min-h-[56px] flex-row items-center gap-3 rounded-xl border border-sand-dark bg-white px-4"
      >
        <Icon name="map-marker-outline" size={20} color="wine" />
        <AppText tone={value ? "ink" : "faint"} className="flex-1 text-lg">
          {value || "Choose your city"}
        </AppText>
        <Icon name="chevron-down" size={20} color="inkMuted" />
      </Pressable>

      <View className="flex-row flex-wrap items-center gap-2">
        <AppText weight="bold" className="text-xs">
          Popular:
        </AppText>
        {POPULAR_CITIES.map((city) => {
          const selected = city === value;
          return (
            <Pressable
              key={city}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(city)}
              className={`rounded-full px-3 py-1.5 ${selected ? "bg-wine" : "bg-sand"}`}
            >
              <AppText weight="semibold" tone={selected ? "white" : "ink"} className="text-xs">
                {city}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <CityPickerModal visible={open} value={value} onClose={() => setOpen(false)} onChoose={choose} />
    </View>
  );
}

type CityPickerModalProps = { visible: boolean; value: string; onClose: () => void; onChoose: (city: string) => void };

/** Full-screen city search. Used by CityPicker, and on its own where a "Change" link opens it. */
export function CityPickerModal({ visible, value, onClose, onChoose }: CityPickerModalProps) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const typed = query.trim();
  const matches = NIGERIAN_CITIES.filter((city) => city.toLowerCase().includes(typed.toLowerCase()));
  const exact = NIGERIAN_CITIES.some((city) => city.toLowerCase() === typed.toLowerCase());

  function choose(city: string) {
    onChoose(city);
    setQuery("");
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-ivory" style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom }}>
        <View className="flex-row items-center gap-3 px-5 pb-3">
          <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={onClose}>
            <Icon name="close" size={24} />
          </Pressable>
          <AppText weight="bold" className="text-xl">
            Your city
          </AppText>
        </View>
        <View className="mx-5 mb-2 min-h-[52px] flex-row items-center gap-2 rounded-xl border border-sand-dark bg-white px-4">
          <Icon name="magnify" size={20} color="inkMuted" />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Search Nigerian cities"
            placeholderTextColor={colors.inkFaint}
            className="flex-1 font-body text-lg text-ink"
            style={noWebFocusRing}
          />
        </View>
        <FlatList
          data={matches}
          keyExtractor={(city) => city}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            typed && !exact ? (
              <Pressable onPress={() => choose(typed)} className="border-b border-sand-dark px-5 py-4">
                <AppText weight="semibold" tone="wine" className="text-base">
                  Use “{typed}”
                </AppText>
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => choose(item)} className="flex-row items-center justify-between border-b border-sand-dark px-5 py-4">
              <AppText className="text-base">{item}</AppText>
              {item === value ? <Icon name="check" size={20} color="wine" /> : null}
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}
