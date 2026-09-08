"use client";

import { authRequest } from "../../lib/auth-api";
import { useAuthAction } from "./use-auth-action";

export function GoogleAuthButton({ action }: { action: "sign in" | "sign up" }) {
  const { pending, run } = useAuthAction();
  return (
    <button className="google-button" aria-label={`Continue to ${action} with Google`} type="button" disabled={pending} onClick={() => void run(async () => {
      const { url } = await authRequest<{ url: string }>("/google", {});
      window.location.assign(url);
    })}>
      <svg className="google-mark" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285f4" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.4 3-7.4Z" />
        <path fill="#34a853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a6 6 0 0 1-5.6-4.2H3.1v2.6A10 10 0 0 0 12 22Z" />
        <path fill="#fbbc05" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9l3.3-2.6Z" />
        <path fill="#ea4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A9.5 9.5 0 0 0 12 2a10 10 0 0 0-8.9 5.5l3.3 2.6A6 6 0 0 1 12 5.9Z" />
      </svg>
      Google
    </button>
  );
}
