"use client";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
export function FieldError({ children }: { children?: string }) { return children ? <p className="field-error" role="alert">{children}</p> : null; }
export function PasswordField({ label, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) { const [show, setShow] = useState(false); const id = props.id ?? props.name; return <div className="field-wrap"><label className="field-label" htmlFor={id}>{label}</label><div className="password-wrap"><input {...props} id={id} className="form-control" type={show ? "text" : "password"} aria-invalid={Boolean(error)} /><button className="icon-btn toggle" type="button" onClick={() => setShow((value) => !value)} aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><FieldError>{error}</FieldError></div>; }
