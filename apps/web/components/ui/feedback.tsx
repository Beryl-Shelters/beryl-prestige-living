"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";

export function Spinner({ label = "Loading" }: { label?: string }) {
  return <span className="spinner" role="status" aria-label={label} />;
}

export function ApiAlert({ children, tone = "error" }: { children: React.ReactNode; tone?: "error" | "info" }) {
  return <div className={`api-alert api-alert-${tone}`} role="alert" aria-live="assertive"><AlertCircle size={17} strokeWidth={2} aria-hidden /> <span>{children}</span></div>;
}

export function LoadingOverlay({ message }: { message: string }) {
  return <div className="loading-overlay" role="status" aria-live="polite"><div className="loading-card"><Spinner /><span>{message}</span></div></div>;
}

export function SuccessState({ title, message }: { title: string; message: string }) {
  return <div role="status" aria-live="polite" className="loading-card"><CheckCircle2 size={44} color="var(--color-brand-success)" aria-hidden /><strong>{title}</strong><span>{message}</span></div>;
}
