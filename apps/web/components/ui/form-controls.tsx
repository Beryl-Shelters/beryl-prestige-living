"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes, useId, useState } from "react";

export function FieldError({ id, children }: { id?: string; children?: React.ReactNode }) {
  if (!children) return null;
  return <p id={id} className="field-error" role="alert">{children}</p>;
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; prefix?: string; formatThousands?: boolean };
export const InputField = forwardRef<HTMLInputElement, InputProps>(function InputField({ label, error, id: providedId, prefix, formatThousands, ...props }, ref) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const errorId = `${id}-error`;
  const input = <input ref={ref} id={id} className="form-control" aria-invalid={Boolean(error)} aria-describedby={error ? errorId : props["aria-describedby"]} {...props} onChange={formatThousands || id === "budget-min" || id === "budget-max" ? (event) => { event.currentTarget.value=event.currentTarget.value.replace(/\D/g,"").replace(/\B(?=(\d{3})+(?!\d))/g,","); props.onChange?.(event); } : props.onChange} />;
  return <div className="field-wrap"><label className="field-label" htmlFor={id}>{label}</label>{prefix ? <div className="input-prefix-wrap"><span className="input-prefix" aria-hidden>{prefix}</span>{input}</div> : input}<FieldError id={errorId}>{error}</FieldError></div>;
});

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string };
export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextAreaField({ label, error, id: providedId, ...props }, ref) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  return <div className="field-wrap"><label className="field-label" htmlFor={id}>{label}</label><textarea ref={ref} id={id} className="form-control" aria-invalid={Boolean(error)} {...props} /><FieldError>{error}</FieldError></div>;
});

export const PasswordField = forwardRef<HTMLInputElement, InputProps>(function PasswordField({ label, error, ...props }, ref) {
  const [visible, setVisible] = useState(false);
  return <div className="field-wrap"><label className="field-label" htmlFor={props.id ?? props.name}>{label}</label><div className="password-wrap"><input ref={ref} id={props.id ?? props.name} className="form-control" type={visible ? "text" : "password"} aria-invalid={Boolean(error)} {...props} /><button className="icon-button password-toggle" type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Hide password" : "Show password"}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button></div><FieldError>{error}</FieldError></div>;
});
