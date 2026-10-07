import { useEffect, useRef } from "react";
import { Pressable, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

import { AppText, Icon } from "@/shared/ui";

const ROW_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const PADDING_ROWS = Math.floor(VISIBLE_ROWS / 2);

type ColumnProps = {
  items: string[];
  index: number;
  onChange: (index: number) => void;
  label: string;
  flex: number;
  locked?: boolean;
};

function WheelColumn({ items, index, onChange, label, flex, locked }: ColumnProps) {
  const scroll = useRef<ScrollView>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Keep the wheel on the selected row when it changes from outside (e.g. 31 → 30 on a shorter month).
  useEffect(() => {
    scroll.current?.scrollTo({ y: index * ROW_HEIGHT, animated: false });
  }, [index]);

  // Settle on the nearest row once scrolling stops. Debounced onScroll works on every platform,
  // including web, where momentum events don't fire.
  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = event.nativeEvent.contentOffset.y;
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const next = Math.max(0, Math.min(items.length - 1, Math.round(y / ROW_HEIGHT)));
      scroll.current?.scrollTo({ y: next * ROW_HEIGHT, animated: true });
      if (next !== index) onChange(next);
    }, 120);
  }

  return (
    <View style={{ flex }} className="items-center">
      <AppText weight="bold" tone="muted" className="mb-2 text-xs tracking-wider">
        {label}
      </AppText>
      <ScrollView
        ref={scroll}
        style={{ height: ROW_HEIGHT * VISIBLE_ROWS, alignSelf: "stretch" }}
        contentContainerStyle={{ paddingVertical: ROW_HEIGHT * PADDING_ROWS }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!locked}
        snapToInterval={ROW_HEIGHT}
        decelerationRate="fast"
        onContentSizeChange={() => scroll.current?.scrollTo({ y: index * ROW_HEIGHT, animated: false })}
        onScroll={handleScroll}
        scrollEventThrottle={32}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text: items[index] }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(event) =>
          onChange(Math.max(0, Math.min(items.length - 1, index + (event.nativeEvent.actionName === "increment" ? 1 : -1))))
        }
      >
        {items.map((item, itemIndex) => {
          const distance = Math.abs(itemIndex - index);
          return (
            <Pressable
              key={item}
              style={{ height: ROW_HEIGHT }}
              className="items-center justify-center"
              disabled={locked}
              onPress={() => onChange(itemIndex)}
            >
              <AppText
                weight={distance === 0 ? "bold" : "semibold"}
                tone={distance === 0 ? "wine" : "faint"}
                className={distance === 0 ? "text-[22px]" : distance === 1 ? "text-xl" : "text-lg opacity-40"}
              >
                {item}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export type DateParts = { year: number; month: number; day: number };

const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

type DateWheelProps = {
  value: DateParts;
  years: number[];
  onChange: (value: DateParts) => void;
  /** Shows the date but ignores input (a saved date of birth can't be changed). */
  locked?: boolean;
};

/** Day / month / year wheels on a sand card, selected row on a white band (Date of birth design). */
export function DateWheel({ value, years, onChange, locked }: DateWheelProps) {
  const days = Array.from({ length: daysIn(value.year, value.month) }, (_, i) => String(i + 1));
  const update = (patch: Partial<DateParts>) => {
    const next = { ...value, ...patch };
    onChange({ ...next, day: Math.min(next.day, daysIn(next.year, next.month)) });
  };

  return (
    <View className="rounded-2xl bg-sand px-3 pb-3 pt-4">
      <View>
        {/* Selected-row band, drawn behind the columns. */}
        <View
          pointerEvents="none"
          className="absolute left-0 right-0 flex-row items-center rounded-xl bg-white px-2"
          style={{ top: 24 + ROW_HEIGHT * PADDING_ROWS, height: ROW_HEIGHT }}
        >
          <View className="h-1.5 w-1.5 rounded-full bg-ink-faint" />
        </View>
        <View className="flex-row">
          <WheelColumn locked={locked} label="DAY" flex={1} items={days} index={value.day - 1} onChange={(i) => update({ day: i + 1 })} />
          <WheelColumn locked={locked} label="MONTH" flex={2} items={MONTHS} index={value.month - 1} onChange={(i) => update({ month: i + 1 })} />
          <WheelColumn
            locked={locked}
            label="YEAR"
            flex={1.3}
            items={years.map(String)}
            index={years.indexOf(value.year)}
            onChange={(i) => update({ year: years[i] })}
          />
        </View>
      </View>
      <View className="mt-2 flex-row items-center justify-between px-2">
        <Icon name="chevron-down" size={16} color="inkMuted" />
        <AppText weight="semibold" tone="muted" className="text-xs">
          Tap options to refine
        </AppText>
        <Icon name="chevron-up" size={16} color="inkMuted" />
      </View>
    </View>
  );
}

export const toIsoDate = ({ year, month, day }: DateParts) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
