"use client";

import { useRef, useState } from "react";
import { showAuthError } from "./toast-provider";

export function useAuthAction() {
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try { await action(); }
    catch (failure) {
      const message = failure instanceof Error ? failure.message : "Please try again.";
      setError(message);
      showAuthError(failure);
    } finally { lock.current = false; setPending(false); }
  }
  return { pending, error, run };
}
