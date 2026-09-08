"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthApiError, authRequest } from "../../lib/auth-api";
import { useAuthAction } from "../../components/auth/use-auth-action";
import { BrandLoader } from "../../components/auth/brand-loader";
import { showAuthError } from "../../components/auth/toast-provider";

// Temporary authenticated entry only; replace when an approved account design exists.
export default function AccountPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const { pending, run } = useAuthAction();
  useEffect(() => {
    let active = true;
    async function check() {
      try {
        await authRequest("/me");
        if (active) setAuthenticated(true);
      } catch (failure) {
        if (!active) return;
        if (failure instanceof AuthApiError && failure.status === 401) {
          setAuthenticated(false); router.replace("/login");
        } else if (!(failure instanceof AuthApiError && failure.code === "SESSION_REFRESHING")) {
          showAuthError(failure, "account-load-error");
        }
      }
    }
    void check();
    const interval = setInterval(() => { void check(); }, 60000);
    return () => { active = false; clearInterval(interval); };
  }, [router]);
  return (
    <main className={authenticated ? "account-entry" : undefined}>
      {authenticated ? <>
        <h1>Account</h1>
        <button type="button" disabled={pending} onClick={() => void run(async () => {
          await authRequest("/logout", {}); setAuthenticated(false); router.replace("/login");
        })}>Log out</button>
      </> : <BrandLoader fullPage />}
    </main>
  );
}
