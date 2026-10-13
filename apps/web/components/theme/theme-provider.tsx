"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export interface ThemeContextValue {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
}

const STORAGE_KEY = "beryl_theme";
const THEME_CHANGE_EVENT = "beryl-theme-change";
const DEFAULT_THEME: ThemePreference = "light";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function subscribeToMedia(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSystemSnapshot(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getSystemServerSnapshot(): ResolvedTheme {
  return "light";
}

function getStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // ignore
  }
  return DEFAULT_THEME;
}

function subscribeToTheme(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const notify = () => callback();
  window.addEventListener("storage", notify);
  window.addEventListener(THEME_CHANGE_EVENT, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(THEME_CHANGE_EVENT, notify);
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribeToTheme, getStoredTheme, () => DEFAULT_THEME);
  const systemTheme = useSyncExternalStore(subscribeToMedia, getSystemSnapshot, getSystemServerSnapshot);

  const resolvedTheme: ResolvedTheme = theme === "system" ? systemTheme : theme;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolvedTheme);
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const setTheme = useCallback((newTheme: ThemePreference) => {
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
      window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    } catch {
      // Storage unavailable
    }
  }, []);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [theme, resolvedTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

export const themeScript = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}')||'light';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){document.documentElement.setAttribute('data-theme','light');document.documentElement.style.colorScheme='light';}})();`;
