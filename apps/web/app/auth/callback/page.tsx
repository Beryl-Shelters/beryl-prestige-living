"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authRequest } from "../../../lib/auth-api";
import { BrandLoader } from "../../../components/auth/brand-loader";
import { showAuthError } from "../../../components/auth/toast-provider";

export default function AuthCallbackPage() {
  const router = useRouter();
  const exchange = useRef<Promise<unknown> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    if (!exchange.current) {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      // Do not leave one-time codes in browser history or forward provider error text.
      window.history.replaceState(null, "", "/auth/callback");
      exchange.current = code && state && !params.has("error")
        ? authRequest("/google/callback", { code, state })
        : Promise.reject(new Error("Google sign-in was cancelled or could not be completed."));
    }
    void exchange.current.then(() => { if (active) router.replace("/account"); })
      .catch((failure: Error) => {
        if (active) { setFailed(true); showAuthError(failure, "google-callback-error"); }
      });
    return () => { active = false; };
  }, [router]);
  return <main className="callback-entry">{failed ? <Link href="/login">Back to log in</Link> : <BrandLoader fullPage />}</main>;
}
