"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { ApiAlert, Spinner } from "@/components/ui/feedback";
import { InputField } from "@/components/ui/form-controls";
import { customerApi } from "@/lib/api/client";
import { apiErrorOf } from "@/lib/api/errors";
import { emailSchema } from "@/lib/validation";
import { useAuth } from "@/context/auth-provider";
import { trackCustomerEvent } from "@/lib/analytics/customer";

export function ForgotPasswordScreen() {
  const router = useRouter();
  const { setResetEmail } = useAuth();
  const [error, setError] = useState("");
  const form = useForm<{ email: string }>({ resolver: zodResolver(emailSchema), defaultValues: { email: "" } });
  const mutation = useMutation({ mutationFn: customerApi.forgotPassword });
  const submit = form.handleSubmit(async ({ email }) => {
    setError("");
    void trackCustomerEvent("Forgot Password Requested", {});
    try { await mutation.mutateAsync({ email: email.trim().toLowerCase() }); setResetEmail(email.trim().toLowerCase()); router.push("/verify-reset-otp"); }
    catch (caught) { setError(apiErrorOf(caught).message); }
  });
  return <main className="min-h-svh bg-brand-canvas p-5 md:p-10"><Link className="eyebrow-link" href="/login"><ArrowLeft size={14} />Back</Link><section className="mx-auto mt-[10svh] w-full max-w-md rounded-card bg-white p-6 shadow-card md:p-10"><div className="mx-auto mb-5 grid h-20 w-28 place-items-center rounded-xl bg-brand-cream"><Mail size={42} color="var(--color-brand-brown)" /></div><h1 className="page-title">Forgot your password?</h1><p className="page-copy">Enter your email and we&apos;ll send a six-digit password reset code.</p><form className="form-stack" onSubmit={submit}><InputField label="Email address" type="email" autoComplete="email" error={form.formState.errors.email?.message} {...form.register("email")} />{error ? <ApiAlert>{error}</ApiAlert> : null}<button className="btn btn-primary" disabled={mutation.isPending}>{mutation.isPending ? <><Spinner />Sending code…</> : "Send reset code"}</button></form></section></main>;
}
