"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customerApi } from "@/lib/api/client";
import type { CustomerSessionState, GettingStartedAs, LoginResult } from "@/lib/contracts";

type PendingSignup = { email: string; maskedEmail: string; intent: GettingStartedAs; password?: string };
type AuthContextValue = {
  session: CustomerSessionState | null;
  sessionLoading: boolean;
  pendingSignup: PendingSignup | null;
  resetEmail: string;
  setPendingSignup: (value: PendingSignup | null) => void;
  setResetEmail: (email: string) => void;
  login: (identifier: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  setSession: (state: CustomerSessionState | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<CustomerSessionState | null>(null);
  const [pendingSignup, setPendingSignupState] = useState<PendingSignup | null>(null);
  const [resetEmail, setResetEmailState] = useState("");
  const restored = useQuery({ queryKey: ["customer-session"], queryFn: () => customerApi.session(), retry: false });

  useEffect(() => {
    if (restored.data?.data) setSession(restored.data.data);
  }, [restored.data]);

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

  const login = async (identifier: string, password: string) => {
    const result = await customerApi.login({ identifier, password });
    setSession(result.data);
    return result.data;
  };
  const logout = async () => {
    try { await customerApi.logout(); } finally { setSession(null); }
  };

  const value = { session: session ?? restored.data?.data ?? null, sessionLoading: restored.isLoading, pendingSignup, resetEmail, setPendingSignup, setResetEmail, login, logout, setSession };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
};
