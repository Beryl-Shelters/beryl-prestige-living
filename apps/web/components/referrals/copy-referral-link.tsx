"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyReferralLink({ value, compact = false }: { value: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return <div className={`referral-copy ${compact ? "referral-copy-compact" : ""}`}>
    <span title={value}>{value}</span>
    <button type="button" onClick={() => { void copy(); }} aria-live="polite" aria-label={copied ? "Referral link copied" : "Copy referral link"}>
      {copied ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}{copied ? "Copied" : "Copy"}
    </button>
  </div>;
}
