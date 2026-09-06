"use client";

import { authRequest } from "../../lib/auth-api";
import { useAuthAction } from "./use-auth-action";

export function GoogleAuthButton({ action }: { action: "sign in" | "sign up" }) {
  const { pending, run } = useAuthAction();
  return (
    <button className="google-button" type="button" disabled={pending} onClick={() => void run(async () => {
      const { url } = await authRequest<{ url: string }>("/google", {});
      window.location.assign(url);
    })}>
      <span aria-hidden="true" className="google-mark">G</span>
      Continue to {action} with Google
    </button>
  );
}
