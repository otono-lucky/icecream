import type { ReactNode } from "react";
import { View } from "react-native";

export function Card({ children, tone = "white" }: { children: ReactNode; tone?: "white" | "sand" }) {
  return <View className={`gap-2 rounded-2xl p-4 ${tone === "white" ? "bg-white" : "bg-sand"}`}>{children}</View>;
}
