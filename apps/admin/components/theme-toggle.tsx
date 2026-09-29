"use client";

import { useAdminTheme, type ThemePreference } from "./theme-provider";

export function AdminThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useAdminTheme();

  const options: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
    {
      value: "system",
      label: "System",
      icon: (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="admin-theme-toggle-icon" aria-hidden="true">
          <rect x="2.5" y="3.5" width="15" height="10" rx="1.5" />
          <path d="M7 16.5h6M10 13.5v3" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      value: "light",
      label: "Light",
      icon: (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="admin-theme-toggle-icon" aria-hidden="true">
          <circle cx="10" cy="10" r="3.75" />
          <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.34 4.34l1.42 1.42M14.24 14.24l1.42 1.42M4.34 15.66l1.42-1.42M14.24 5.76l1.42-1.42" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      value: "dark",
      label: "Dark",
      icon: (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="admin-theme-toggle-icon" aria-hidden="true">
          <path d="M17.29 13.27A8 8 0 0 1 6.73 2.71 8.002 8.002 0 1 0 17.29 13.27Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className={`admin-theme-toggle ${className}`}
      role="radiogroup"
      aria-label="Admin theme preference"
    >
      {options.map((opt) => {
        const isSelected = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={`admin-theme-toggle-btn${isSelected ? " is-active" : ""}`}
            onClick={() => setTheme(opt.value)}
            title={`Use ${opt.label} appearance`}
            aria-label={`${opt.label} theme`}
          >
            {opt.icon}
            <span className="admin-theme-toggle-label">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
