"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export function OnboardingFrame({ children, label, intent = "FIND_PROPERTY" }: { children: React.ReactNode; label: string; intent?: "FIND_PROPERTY" | "LIST_PROPERTY" }) {
  const router = useRouter();
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = dialog.current;
    if (!root) return;
    const focusable = () => Array.from(root.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]"));
    focusable()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") router.back();
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    root.addEventListener("keydown", keydown);
    return () => root.removeEventListener("keydown", keydown);
  }, [router]);
  return <main className="onboarding-stage" data-intent={intent}><div className="onboarding-backdrop" aria-hidden /><section ref={dialog} className="onboarding-card" role="dialog" aria-modal="true" aria-label={label}>{children}</section></main>;
}
