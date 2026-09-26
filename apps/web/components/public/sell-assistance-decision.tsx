"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";

export function SellAssistanceDecision({ open, onClose, onNo, onYes }: { open: boolean; onClose: () => void; onNo: () => void; onYes: () => void }) {
  const dialog = useRef<HTMLDivElement>(null); const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; close.current?.focus();
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  function keys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (event.key !== "Tab" || !dialog.current) return;
    const items = [...dialog.current.querySelectorAll<HTMLElement>('button:not([disabled])')]; const first = items[0], last = items.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  if (!open) return null;
  return <div className="sell-decision-backdrop"><div ref={dialog} className="sell-decision-dialog" role="dialog" aria-modal="true" aria-labelledby="sell-decision-title" onKeyDown={keys}>
    <button ref={close} className="sell-decision-close" type="button" aria-label="Close sell assistance prompt" onClick={onClose}>×</button>
    <span className="sell-decision-icon" aria-hidden="true">?</span><h2 id="sell-decision-title">Do you need assistance</h2>
    <div className="sell-decision-actions"><button type="button" className="sell-decision-no" onClick={onNo}>No</button><button type="button" className="sell-decision-yes" onClick={onYes}>Yes</button></div>
  </div></div>;
}
