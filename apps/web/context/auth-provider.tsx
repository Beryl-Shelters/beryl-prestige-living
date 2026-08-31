"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customerApi } from "@/lib/api/client";
import { customerPersonaForAnalytics, identifyCustomerAnalytics, resetCustomerAnalytics, trackCustomerEvent } from "@/lib/analytics/customer";
import type { CustomerSessionState, GettingStartedAs, LoginResult } from "@/lib/contracts";

type PendingSignup = { email: string; maskedEmail: string; intent: GettingStartedAs; password?: string };
type AuthContextValue = {
  session: CustomerSessionState | null;
  sessionLoading: boolean;
  pendingSignup: PendingSignup | null;
  resetEmail: string;
  setPendingSignup: (value: PendingSignup | null) => void;
  setResetEmail: (email: string) => void;
  login: (identifier: string, password: string, analyticsDistinctId?: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  logoutPending: boolean;
  refreshSession: () => Promise<CustomerSessionState>;
  setSession: (state: CustomerSessionState | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<CustomerSessionState | null>(null);
  const [logoutPending, setLogoutPending] = useState(false);
  const logoutInFlight = useRef<Promise<void> | null>(null);
  const [pendingSignup, setPendingSignupState] = useState<PendingSignup | null>(null);
  const [resetEmail, setResetEmailState] = useState("");
  const restored = useQuery({ queryKey: ["customer-session"], queryFn: () => customerApi.session(), retry: false });

  useEffect(() => {
    if (restored.data?.data) setSession(restored.data.data);
  }, [restored.data]);

  const activeSession = session ?? restored.data?.data ?? null;
  const analyticsAccountId = activeSession?.user.id;
  const analyticsActivePersona = activeSession?.activePersona;

  useEffect(() => {
    if (!analyticsAccountId || !analyticsActivePersona) return;
    void identifyCustomerAnalytics(analyticsAccountId, customerPersonaForAnalytics(analyticsActivePersona));
  }, [analyticsAccountId, analyticsActivePersona]);

  useEffect(() => {
    const saved = sessionStorage.getItem("beryl-auth-flow");
    if (!saved) return;
    try {
      const value = JSON.parse(saved) as { email?: string; maskedEmail?: string; intent?: GettingStartedAs; resetEmail?: string };
      if (value.email && value.maskedEmail && value.intent) setPendingSignupState({ email: value.email, maskedEmail: value.maskedEmail, intent: value.intent });
      if (value.resetEmail) setResetEmailState(value.resetEmail);
    } catch {
      sessionStorage.removeItem("beryl-auth-flow");
    }
  }, []);

  const persist = (pending: PendingSignup | null, reset: string) => {
    if (!pending && !reset) return sessionStorage.removeItem("beryl-auth-flow");
    sessionStorage.setItem("beryl-auth-flow", JSON.stringify({ email: pending?.email, maskedEmail: pending?.maskedEmail, intent: pending?.intent, resetEmail: reset }));
  };

  const setPendingSignup = (value: PendingSignup | null) => {
    setPendingSignupState(value);
    persist(value, resetEmail);
  };
  const setResetEmail = (value: string) => {
    setResetEmailState(value);
    persist(pendingSignup, value);
  };

  const login = async (identifier: string, password: string, analyticsDistinctId?: string) => {
    const result = await customerApi.login({ identifier, password }, analyticsDistinctId);
    setSession(result.data);
    return result.data;
  };
  const logout = () => {
    if (logoutInFlight.current) return logoutInFlight.current;
    const operation = (async () => {
      setLogoutPending(true);
      void trackCustomerEvent("Logout", {});
      try {
        await customerApi.logout();
      } catch {
        // The BFF clears HttpOnly cookies even when the upstream is unavailable.
      } finally {
        try { await resetCustomerAnalytics(); } catch { /* Session cleanup remains authoritative. */ }
        setSession(null);
        queryClient.setQueryData(["customer-session"], null);
        queryClient.removeQueries({
          predicate: ({ queryKey }) => {
            const key = queryKey[0];
            return typeof key === "string" && (
              key === "personas" ||
              key === "saved-properties" ||
              key === "marketplace-properties" ||
              key === "marketplace-property" ||
              key.startsWith("seller-") ||
              key.startsWith("referral-")
            );
          }
        });
        setLogoutPending(false);
      }
    })();
    logoutInFlight.current = operation.finally(() => { logoutInFlight.current = null; });
    return logoutInFlight.current;
  };

  const refreshSession = async () => {
    const refreshed = await restored.refetch();
    if (refreshed.error) throw refreshed.error;
    if (!refreshed.data?.data) throw new Error("Customer session could not be refreshed");
    setSession(refreshed.data.data);
    return refreshed.data.data;
  };

  const value = { session: activeSession, sessionLoading: restored.isLoading, pendingSignup, resetEmail, setPendingSignup, setResetEmail, login, logout, logoutPending, refreshSession, setSession };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
};
