"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { ApiAlert, Spinner } from "@/components/ui/feedback";
import { PasswordField } from "@/components/ui/form-controls";
import { PasswordStrength } from "./password-strength";
import { customerApi } from "@/lib/api/client";
import { apiErrorOf } from "@/lib/api/errors";
import { resetPasswordSchema } from "@/lib/validation";

type Values = { newPassword: string; confirmPassword: string };
export function ResetPasswordScreen() {
  const router = useRouter();
  const [error, setError] = useState("");
  const form = useForm<Values>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { newPassword: "", confirmPassword: "" } });
  const mutation = useMutation({ mutationFn: customerApi.resetPassword });
  const submit = form.handleSubmit(async (values) => {
    setError("");
    try { await mutation.mutateAsync(values); router.replace("/login"); }
    catch (caught) { setError(apiErrorOf(caught).message); }
  });
  return <main className="min-h-svh bg-brand-canvas p-5 md:p-10"><Link className="eyebrow-link" href="/forgot-password"><ArrowLeft size={14} />Back</Link><section className="mx-auto mt-[7svh] w-full max-w-md rounded-card bg-white p-6 shadow-card md:p-10"><div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-brand-cream"><LockKeyhole size={40} color="var(--color-brand-brown)" /></div><h1 className="page-title">Set a new password</h1><p className="page-copy">Choose a new password for your account. Make it one you&apos;ll remember.</p><form className="form-stack" onSubmit={submit}><PasswordField label="New password" autoComplete="new-password" error={form.formState.errors.newPassword?.message} {...form.register("newPassword")} />{form.watch("newPassword") ? <PasswordStrength password={form.watch("newPassword")} /> : null}<PasswordField label="Confirm new password" autoComplete="new-password" error={form.formState.errors.confirmPassword?.message} {...form.register("confirmPassword")} /><ApiAlert tone="info">For your security, you will be logged out on all devices and need to log in again.</ApiAlert>{error ? <ApiAlert>{error}</ApiAlert> : null}<button className="btn btn-primary" disabled={mutation.isPending}>{mutation.isPending ? <><Spinner />Saving…</> : "Save new password"}</button></form></section></main>;
}
