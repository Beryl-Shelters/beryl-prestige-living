import { Check, Circle } from "lucide-react";

export const passwordChecks = (password: string) => [
  ["At least 8 characters", password.length >= 8],
  ["1 uppercase character", /[A-Z]/.test(password)],
  ["1 lowercase character", /[a-z]/.test(password)],
  ["1 number", /\d/.test(password)],
  ["1 special character", /[^A-Za-z0-9]/.test(password)]
] as const;

export function PasswordStrength({ password }: { password: string }) {
  const checks = passwordChecks(password);
  const score = checks.filter(([, valid]) => valid).length;
  const label = score <= 2 ? "Weak" : score <= 4 ? "Good" : "Strong";
  return <div aria-live="polite" className="grid gap-2 text-xs"><div className="flex items-center justify-between"><strong>{label}</strong><span>{score}/5</span></div><div className="h-1.5 overflow-hidden rounded-full bg-brand-field"><div className="h-full bg-brand-brown transition-all" style={{ width: `${score * 20}%` }} /></div><p>Password must contain</p><ul className="grid gap-1.5">{checks.map(([text, valid]) => <li key={text} className="flex items-center gap-2 text-brand-muted">{valid ? <Check size={14} color="var(--color-brand-brown)" aria-hidden /> : <Circle size={12} aria-hidden />}{text}</li>)}</ul></div>;
}
