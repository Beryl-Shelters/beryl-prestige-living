"use client";

import { useRef, useState } from "react";

export function OtpInput() {
  const [digits, setDigits] = useState<string[]>(Array.from({ length: 6 }, () => ""));
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  function setDigit(index: number, rawValue: string) {
    const next = rawValue.replace(/\D/g, "").slice(-1);
    setDigits((current) => current.map((digit, currentIndex) => currentIndex === index ? next : digit));
    if (next && index < 5) inputs.current[index + 1]?.focus();
  }

  function onKeyDown(index: number, key: string) {
    if (key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  function onPaste(text: string) {
    const pasted = text.replace(/\D/g, "").slice(0, 6).split("");
    if (!pasted.length) return;
    setDigits(Array.from({ length: 6 }, (_, index) => pasted[index] ?? ""));
    inputs.current[Math.min(pasted.length, 6) - 1]?.focus();
  }

  return (
    <div className="otp-input" role="group" aria-label="Six-digit verification code" onPaste={(event) => { event.preventDefault(); onPaste(event.clipboardData.getData("text")); }}>
      <input type="hidden" name="code" value={digits.join("")} />
      {digits.map((digit, index) => (
        <input
          aria-label={`Verification digit ${index + 1}`}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          required
          pattern="[0-9]"
          key={index}
          maxLength={1}
          onChange={(event) => setDigit(index, event.target.value)}
          onKeyDown={(event) => onKeyDown(index, event.key)}
          ref={(element) => { inputs.current[index] = element; }}
          type="text"
          value={digit}
        />
      ))}
    </div>
  );
}
