export type ThemePreference = "system" | "light" | "dark";
export type EffectiveTheme = "light" | "dark";

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "light";

export function resolveThemePreference(
  preference: ThemePreference,
  systemScheme: "light" | "dark" | "unspecified" | null | undefined,
): EffectiveTheme {
  if (preference === "system") return systemScheme === "dark" ? "dark" : "light";
  return preference;
}
