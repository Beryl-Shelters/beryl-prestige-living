import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode, SetStateAction } from "react";
import type { Href } from "expo-router";
import { getAuthenticated } from "@/api/client";
import type { CustomerSession, NextAction, OnboardingStatus, VerificationFlow } from "@/types/auth";

const FlowContext = createContext<{ flow: VerificationFlow | null; setFlow: (flow: SetStateAction<VerificationFlow | null>) => void }>({ flow: null, setFlow: () => undefined });
const ACCESS_KEY = "beryl_customer_access_token";
const REFRESH_KEY = "beryl_customer_refresh_token";
const actionRoutes: Record<NextAction, Href> = { COMPLETE_BUYER_ONBOARDING: "/buyer", COMPLETE_SELLER_ONBOARDING: "/seller", OPEN_BUYER_DASHBOARD: "/buyer-dashboard", OPEN_SELLER_DASHBOARD: "/seller-dashboard" };

export function AuthFlowProvider({ children }: { children: ReactNode }) { const [flow, setFlow] = useState<VerificationFlow | null>(null); return <FlowContext.Provider value={{ flow, setFlow }}>{children}</FlowContext.Provider>; }
export const useAuthFlow = () => useContext(FlowContext);
export const secureSession = { save: async (accessToken: string, refreshToken: string) => Promise.all([SecureStore.setItemAsync(ACCESS_KEY, accessToken), SecureStore.setItemAsync(REFRESH_KEY, refreshToken)]), restore: async () => Promise.all([SecureStore.getItemAsync(ACCESS_KEY), SecureStore.getItemAsync(REFRESH_KEY)]), clear: async () => Promise.all([SecureStore.deleteItemAsync(ACCESS_KEY), SecureStore.deleteItemAsync(REFRESH_KEY)]) };

type SessionContextValue = { isAuthenticated: boolean; isHydrating: boolean; customer: CustomerSession["user"]; activePersona: CustomerSession["activePersona"] | null; personas: CustomerSession["personas"]; accessToken: string | null; establishSession: (session: CustomerSession) => Promise<void>; clearSession: () => Promise<void>; restoreSession: () => Promise<OnboardingStatus | null>; updatePersonaState: (status: OnboardingStatus) => void; routeFromNextAction: (action: NextAction) => Href; };
const SessionContext = createContext<SessionContextValue | null>(null);

export function CustomerSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [isHydrating, setHydrating] = useState(true);
  const clearSession = async () => { await secureSession.clear(); setSession(null); };
  const updatePersonaState = (status: OnboardingStatus) => setSession((current) => current ? { ...current, activePersona: status.activePersona, personas: status.personas, nextAction: status.nextAction } : current);
  const restoreSession = async () => {
    const [accessToken, refreshToken] = await secureSession.restore();
    if (!accessToken || !refreshToken) { setHydrating(false); return null; }
    try {
      const response = await getAuthenticated<OnboardingStatus>("/onboarding/status", accessToken);
      const status = response.data ?? null;
      if (status) setSession({ accessToken, refreshToken, user: null, activePersona: status.activePersona, personas: status.personas, nextAction: status.nextAction });
      return status;
    } catch { await clearSession(); return null; } finally { setHydrating(false); }
  };
  useEffect(() => { void restoreSession(); }, []);
  const value = useMemo<SessionContextValue>(() => ({ isAuthenticated: Boolean(session), isHydrating, customer: session?.user ?? null, activePersona: session?.activePersona ?? null, personas: session?.personas ?? [], accessToken: session?.accessToken ?? null, establishSession: async (next) => { await secureSession.save(next.accessToken, next.refreshToken); setSession(next); setHydrating(false); }, clearSession, restoreSession, updatePersonaState, routeFromNextAction: (action) => actionRoutes[action] }), [session, isHydrating]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
export const useCustomerSession = () => { const context = useContext(SessionContext); if (!context) throw new Error("CustomerSessionProvider is required"); return context; };
