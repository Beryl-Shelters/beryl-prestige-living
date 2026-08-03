"use client";

import { ClipboardEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

export function OtpInput({ onComplete, disabled = false, resetKey }: { onComplete: (otp: string) => void; disabled?: boolean; resetKey?: number }) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => setDigits(["", "", "", "", "", ""]), [resetKey]);

  const commit = (next: string[]) => {
    setDigits(next);
    const otp = next.join("");
    if (otp.length === 6) onComplete(otp);
  };
  const update = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    commit(next);
    if (digit && index < 5) refs.current[index + 1]?.focus();
  };
  const keyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) refs.current[index - 1]?.focus();
    if (event.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < 5) refs.current[index + 1]?.focus();
  };
  const paste = (event: ClipboardEvent<HTMLDivElement>) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    const next = Array.from({ length: 6 }, (_, index) => pasted[index] ?? "");
    commit(next);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return <div className="otp-row" onPaste={paste} role="group" aria-label="Six-digit verification code">{digits.map((digit, index) => <input key={index} ref={(element) => { refs.current[index] = element; }} className="otp-box" value={digit} disabled={disabled} onChange={(event) => update(index, event.target.value)} onKeyDown={(event) => keyDown(index, event)} inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} maxLength={1} aria-label={`Digit ${index + 1}`} />)}</div>;
}
