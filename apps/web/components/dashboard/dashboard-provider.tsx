"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AuthApiError, authRequest } from "../../lib/auth-api";
import { fetchDashboard, type DashboardOverview } from "../../lib/dashboard-api";
import { BrandLoader } from "../auth/brand-loader";
import { BrandLogo } from "../auth/brand-logo";
import { showAuthError } from "../auth/toast-provider";
import { useAuthAction } from "../auth/use-auth-action";

const DashboardContext = createContext<{ overview: DashboardOverview; logout: () => void; loggingOut: boolean } | null>(null);
export function DashboardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const leaving = useRef(false);
  const { pending, run } = useAuthAction();
  useEffect(() => {
    const controller = new AbortController();
    let checking = false;
    async function check() {
      if (checking || leaving.current) return;
      checking = true;
      try {
        const data = await fetchDashboard(controller.signal);
        if (!controller.signal.aborted && !leaving.current) { setOverview(data); setFailed(false); }
      } catch (error) {
        if (controller.signal.aborted || leaving.current) return;
        if (error instanceof AuthApiError && error.status === 401) {
          leaving.current = true; setOverview(null); router.replace("/login");
        } else { setFailed(true); showAuthError(error, "dashboard-fetch-error"); }
      } finally { checking = false; }
    }
    void check();
    const interval = setInterval(() => { void check(); }, 60000);
    const onFocus = () => { void check(); };
    window.addEventListener("focus", onFocus);
    return () => { controller.abort(); clearInterval(interval); window.removeEventListener("focus", onFocus); };
  }, [attempt, router]);
  if (!overview) return failed ? <main className="dashboard-retry">
    <BrandLogo size={64} />
    <button className="button button-primary" onClick={() => { setFailed(false); setAttempt((value) => value + 1); }}>Try again</button>
    <Link href="/login">Back to log in</Link>
  </main> : <BrandLoader fullPage />;
  function logout() {
    void run(async () => {
      await authRequest("/logout", {});
      leaving.current = true; setOverview(null); router.replace("/login");
    });
  }
  return <DashboardContext.Provider value={{ overview, logout, loggingOut: pending }}>{children}</DashboardContext.Provider>;
}
export function useDashboard() {
  const value = useContext(DashboardContext);
  if (!value) throw new Error("Dashboard components require DashboardProvider");
  return value;
}
