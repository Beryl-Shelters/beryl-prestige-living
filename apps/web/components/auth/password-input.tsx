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
      <label htmlFor={id}>{label}</label>
      <div className="password-control">
        <input id={id} name={id} type={visible ? "text" : "password"} autoComplete={autoComplete} required minLength={autoComplete === "new-password" ? 12 : undefined} maxLength={128} />
        <button
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="password-toggle"
          onClick={() => setVisible((value) => !value)}
          type="button"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
