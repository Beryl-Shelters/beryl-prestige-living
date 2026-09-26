"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";

type AssistanceDecisionProps = {
  open: boolean;
  kind: "buy" | "sell";
  question?: string;
  onClose: () => void;
  onNo: () => void;
  onYes: () => void;
};

export function AssistanceDecision({ open, kind, question = "Do you need Assistance?", onClose, onNo, onYes }: AssistanceDecisionProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const titleId = `${kind}-assistance-decision-title`;

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    close.current?.focus();
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  function keys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (event.key !== "Tab" || !dialog.current) return;
    const items = [...dialog.current.querySelectorAll<HTMLElement>('button:not([disabled])')];
    const first = items[0];
    const last = items.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  if (!open) return null;
  return <div className="assistance-decision-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialog} className="assistance-decision-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={keys}>
      <button ref={close} className="assistance-decision-close" type="button" aria-label={`Close ${kind} assistance prompt`} onClick={onClose}>×</button>
      <span className="assistance-decision-icon" aria-hidden="true">?</span>
      <h2 id={titleId}>{question}</h2>
      <div className="assistance-decision-actions">
        <button type="button" className="assistance-decision-no" onClick={onNo}>No</button>
        <button type="button" className="assistance-decision-yes" onClick={onYes}>Yes</button>
      </div>
    </div>
  </div>;
}
