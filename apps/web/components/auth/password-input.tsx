"use client";

import { useState } from "react";

type PasswordInputProps = {
  id: string;
  label: string;
  autoComplete: string;
};

export function PasswordInput({ id, label, autoComplete }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="field-group">
      <label htmlFor={id}>{label.replace(/\s*\*$/, "")} <span aria-hidden="true">*</span></label>
      <div className="password-control">
        {/* Form submission validates new passwords together, using the existing error/toast UI. */}
        <input id={id} name={id} type={visible ? "text" : "password"} autoComplete={autoComplete} placeholder="********" required maxLength={128} />
        <button
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="password-toggle"
          onClick={() => setVisible((value) => !value)}
          type="button"
        >
          <PasswordVisibilityIcon visible={visible} />
        </button>
      </div>
    </div>
  );
}

export function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
      <path d="M9.9 4.3A10.8 10.8 0 0 1 12 4c5.5 0 9 5.2 9 5.2a13.8 13.8 0 0 1-2.1 2.7M6.6 6.6C4.4 8.1 3 10.2 3 10.2S6.5 16 12 16c1.3 0 2.5-.3 3.6-.7" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}
