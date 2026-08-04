import { Check, Circle } from "lucide-react";

export const passwordChecks = (password: string) => [
  ["At least 8 characters", password.length >= 8],
  ["At least 1 uppercase letter", /[A-Z]/.test(password)],
  ["At least 1 lowercase letter", /[a-z]/.test(password)],
  ["At least 1 number", /\d/.test(password)],
  ["At least 1 special character", /[^A-Za-z0-9]/.test(password)]
] as const;

export function PasswordStrength({ password }: { password: string }) {
  const checks = passwordChecks(password);
  const score = checks.filter(([, valid]) => valid).length;
  const strength = score === 0 ? "neutral" : score <= 2 ? "weak" : score <= 4 ? "moderate" : "strong";
  const label = score === 0 ? "Meter" : score <= 2 ? "Weak" : score <= 4 ? "Moderate" : "Strong";
  const help = strength === "weak" ? "Try a longer, more unique password that is harder to guess." : strength === "moderate" ? "Getting stronger. Add more symbols or numbers for better protection." : strength === "strong" ? "Great job! This password is strong and secure." : "";
  return <div aria-live="polite" className="password-strength grid gap-2 text-xs" data-strength={strength}><div className="flex items-center justify-between"><strong>{label}</strong><span>{score}/5</span></div><div className="password-meter" role="progressbar" aria-label="Password strength" aria-valuemin={0} aria-valuemax={5} aria-valuenow={score}><div className="password-meter-fill" data-strength={strength} style={{ width: `${score * 20}%` }} /></div>{help ? <p>{help}</p> : null}<p>Password must contain</p><ul className="grid gap-1.5">{checks.map(([text, valid]) => <li key={text} className="password-requirement flex items-center gap-2 text-brand-muted" aria-label={`${text}: ${valid ? "met" : "not met"}`}>{valid ? <Check className="password-requirement-check" size={15} aria-hidden /> : <Circle size={13} aria-hidden />}{text}</li>)}</ul></div>;
}
