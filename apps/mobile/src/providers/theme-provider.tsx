import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { Platform, useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import {
  getColors,
  spacing,
  radius,
  typography,
  elevation,
  type ColorTokens,
} from "@/theme/tokens";

export type ThemePreference = "system" | "light" | "dark";
export type EffectiveTheme = "light" | "dark";

export interface ThemeContextValue {
  themePreference: ThemePreference;
  effectiveTheme: EffectiveTheme;
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  elevation: typeof elevation;
  setThemePreference: (pref: ThemePreference) => Promise<void>;
}

const STORAGE_KEY = "beryl_mobile_theme";
const LEGACY_STORAGE_KEY = "beryl.v2.customer.theme_preference";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function validPreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

async function readStoredTheme(): Promise<ThemePreference> {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        const item = window.localStorage.getItem(STORAGE_KEY);
        if (validPreference(item)) return item;
        const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
        if (validPreference(legacy)) {
          window.localStorage.setItem(STORAGE_KEY, legacy);
          return legacy;
        }
      }
      return "system";
    }
    const item = await SecureStore.getItemAsync(STORAGE_KEY);
    if (validPreference(item)) return item;
    const legacy = await SecureStore.getItemAsync(LEGACY_STORAGE_KEY);
    if (validPreference(legacy)) {
      await SecureStore.setItemAsync(STORAGE_KEY, legacy);
      return legacy;
    }
  } catch {
    // Ignore read errors
  }
  return "system";
}

async function writeStoredTheme(pref: ThemePreference): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, pref);
      }
      return;
    }
    await SecureStore.setItemAsync(STORAGE_KEY, pref);
  } catch {
    // Ignore write errors
  }
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [themePreference, setThemeState] = useState<ThemePreference>("system");
  const systemScheme = useColorScheme();

  useEffect(() => {
    let active = true;
    void readStoredTheme().then((stored) => {
      if (active) setThemeState(stored);
    });
    return () => {
      active = false;
    };
  }, []);

  const effectiveTheme: EffectiveTheme = useMemo(() => {
    if (themePreference === "system") {
      return systemScheme === "dark" ? "dark" : "light";
    }
    return themePreference;
  }, [themePreference, systemScheme]);

  const activeColors = useMemo(() => getColors(effectiveTheme), [effectiveTheme]);

  const setThemePreference = useCallback(async (newPref: ThemePreference) => {
    setThemeState(newPref);
    await writeStoredTheme(newPref);
  }, []);

  const value = useMemo(
    () => ({
      themePreference,
      effectiveTheme,
      colors: activeColors,
      spacing,
      radius,
      typography,
      elevation,
      setThemePreference,
    }),
    [themePreference, effectiveTheme, activeColors, setThemePreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
