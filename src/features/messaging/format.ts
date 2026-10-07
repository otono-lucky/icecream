/** "14:05" today, "Mon" this week, otherwise "12 Sep". */
export function formatSentAt(ms: number, now = new Date()): string {
  const date = new Date(ms);
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
  const days = (now.getTime() - ms) / 86_400_000;
  if (days < 6) return date.toLocaleDateString("en-NG", { weekday: "short" });
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

/** Divider label between days: "Today", "Yesterday", "Monday", or "12 September 2026". */
export function dayLabel(ms: number, now = new Date()): string {
  const day = new Date(ms);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const daysAgo = Math.round((startOf(now) - startOf(day)) / 86_400_000);
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo < 7) return day.toLocaleDateString("en-NG", { weekday: "long" });
  return day.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
}

export const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();
