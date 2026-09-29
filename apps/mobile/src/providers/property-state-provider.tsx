import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { propertiesApi } from "@/lib/properties-api";
import { toggleComparison } from "@/lib/comparison";
import type { PublicProperty } from "@/lib/property-types";
import { useAuth } from "./auth-provider";

type PropertyState = {
  savedCodes: ReadonlySet<string>;
  compared: PublicProperty[];
  refreshSaved: (codes: string[]) => Promise<void>;
  setSaved: (code: string, saved: boolean) => void;
  toggleCompared: (property: PublicProperty) => "added" | "removed" | "limit";
  removeCompared: (code: string) => void;
  clearCompared: () => void;
};

const PropertyStateContext = createContext<PropertyState | null>(null);

export function PropertyStateProvider({ children }: PropsWithChildren) {
  const { status } = useAuth();
  const [savedCodes, setSavedCodes] = useState<Set<string>>(() => new Set());
  const [compared, setCompared] = useState<PublicProperty[]>([]);
  useEffect(() => { if (status === "signedOut") queueMicrotask(() => { setSavedCodes(new Set()); setCompared([]); }); }, [status]);
  const refreshSaved = useCallback(async (codes: string[]) => {
    const unique = [...new Set(codes)].filter(Boolean).slice(0, 50);
    if (status !== "signedIn" || !unique.length) return;
    const result = await propertiesApi.savedStates(unique);
    const received = new Set(result.propertyCodes);
    setSavedCodes(current => {
      const next = new Set(current);
      for (const code of unique) { if (received.has(code)) next.add(code); else next.delete(code); }
      return next;
    });
  }, [status]);
  const setSaved = useCallback((code: string, saved: boolean) => setSavedCodes(current => {
    const next = new Set(current); if (saved) next.add(code); else next.delete(code); return next;
  }), []);
  const toggleCompared = useCallback((property: PublicProperty) => {
    let outcome: "added" | "removed" | "limit" = "limit";
    setCompared(current => {
      const result = toggleComparison(current, property); outcome = result.outcome; return result.items;
    });
    return outcome;
  }, []);
  const removeCompared = useCallback((code: string) => setCompared(current => current.filter(item => item.code !== code)), []);
  const clearCompared = useCallback(() => setCompared([]), []);
  const value = useMemo(() => ({ savedCodes, compared, refreshSaved, setSaved, toggleCompared, removeCompared, clearCompared }), [savedCodes, compared, refreshSaved, setSaved, toggleCompared, removeCompared, clearCompared]);
  return <PropertyStateContext.Provider value={value}>{children}</PropertyStateContext.Provider>;
}

export function usePropertyState() {
  const value = useContext(PropertyStateContext);
  if (!value) throw new Error("usePropertyState must be used within PropertyStateProvider");
  return value;
}
