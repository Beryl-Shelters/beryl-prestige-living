"use client";

import { useRef, useState } from "react";
import { toast } from "react-toastify";

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
      toast.error(message);
    } finally { lock.current = false; setPending(false); }
  }
  return { pending, error, run };
}
