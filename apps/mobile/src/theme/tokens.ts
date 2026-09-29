import { Platform, type TextStyle, type ViewStyle } from "react-native";

export const colors = {
  background: "#F7F5F2",
  surface: "#FFFFFF",
  surfaceMuted: "#F1EEEA",
  text: "#21170E",
  textMuted: "#6F675F",
  border: "#DED8D1",
  brand: "#BC8748",
  brandDark: "#815914",
  brandGold: "#BC8748",
  brandTint: "#FBF7F0",
  action: "#17120E",
  actionText: "#FFFFFF",
  success: "#287A4C",
  warning: "#9B671A",
  danger: "#C93E3E",
  overlay: "rgba(24, 18, 13, 0.48)",
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, hero: 48 } as const;
export const radius = { xs: 4, sm: 8, md: 12, lg: 18, pill: 999 } as const;
export const typography: Record<"display" | "title" | "heading" | "subheading" | "body" | "label" | "caption", TextStyle> = {
  display: { fontSize: 32, lineHeight: 39, fontWeight: "700" },
  title: { fontSize: 24, lineHeight: 31, fontWeight: "700" },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: "700" },
  subheading: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400" },
  label: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "400" },
};
export const elevation: ViewStyle = Platform.select({
  android: { elevation: 2 },
  default: { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
});
