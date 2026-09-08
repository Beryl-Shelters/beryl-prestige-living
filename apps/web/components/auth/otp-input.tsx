"use client";

import { useEffect, useRef, useState } from "react";

type OtpInputProps = {
  id?: string;
  disabled?: boolean;
  onComplete?: (code: string) => void;
};

export function OtpInput({ id, disabled = false, onComplete }: OtpInputProps = {}) {
  const [digits, setDigits] = useState<string[]>(Array.from({ length: 6 }, () => ""));
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const lastCompletedCode = useRef<string | null>(null);
  const code = digits.join("");

  useEffect(() => {
    if (code.length !== 6) {
      lastCompletedCode.current = null;
      return;
    }
    if (disabled || !onComplete || lastCompletedCode.current === code) return;
    // Remember before calling: a failed request or parent rerender must not
    // automatically retry the same completed code in a submission loop.
    lastCompletedCode.current = code;
    onComplete(code);
  }, [code, disabled, onComplete]);

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
    if (disabled) return;
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
          id={index === 0 ? id : undefined}
          disabled={disabled}
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
