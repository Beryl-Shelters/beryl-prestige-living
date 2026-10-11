"use client";

import { useEffect, useId, useRef, useState } from "react";
import { terminology, type TerminologyKey } from "../lib/terminology";

export function TerminologyHelp({ term }: { term: TerminologyKey }) {
  const content = terminology[term];
  const tooltipId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pinnedRef = useRef(false);
  const [open, setOpen] = useState(false);

  const close = (restoreFocus = false) => {
    pinnedRef.current = false;
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span
      className="terminology-help"
      ref={rootRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        if (!pinnedRef.current) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="terminology-help-trigger"
        aria-label={`Explain ${content.title}`}
        aria-expanded={open}
        aria-controls={tooltipId}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          if (!pinnedRef.current && !rootRef.current?.contains(event.relatedTarget)) setOpen(false);
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          pinnedRef.current = !pinnedRef.current;
          setOpen(pinnedRef.current);
        }}
      >
        <span aria-hidden="true">?</span>
      </button>
      {open ? (
        <span className="terminology-help-popover" id={tooltipId} role="tooltip">
          <strong>{content.title}</strong>
          <span>{content.description}</span>
        </span>
      ) : null}
    </span>
  );
}
