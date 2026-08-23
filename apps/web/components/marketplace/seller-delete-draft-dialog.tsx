"use client";

import { useEffect, useRef } from "react";

export function SellerDeleteDraftDialog({
  open,
  pending,
  error,
  onCancel,
  onConfirm
}: {
  open: boolean;
  pending: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onCancel();
      if (event.key !== "Tab") return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])") ?? []);
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => { window.removeEventListener("keydown", handleKey); previouslyFocused?.focus(); };
  }, [onCancel, open, pending]);

  if (!open) return null;
  return <div className="seller-delete-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !pending) onCancel(); }}>
    <section ref={dialogRef} className="seller-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="seller-delete-title" aria-describedby="seller-delete-copy">
      <h2 id="seller-delete-title">Delete this draft?</h2>
      <p id="seller-delete-copy">This draft and its uploaded photos/documents will be permanently removed. This action cannot be undone.</p>
      {error ? <p className="seller-delete-error" role="alert">{error}</p> : null}
      <div>
        <button ref={cancelRef} className="btn btn-secondary" type="button" disabled={pending} onClick={onCancel}>Cancel</button>
        <button className="btn seller-delete-confirm" type="button" disabled={pending} onClick={onConfirm}>{pending ? "Deleting…" : "Delete draft"}</button>
      </div>
    </section>
  </div>;
}
