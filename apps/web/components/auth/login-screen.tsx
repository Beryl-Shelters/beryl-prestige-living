"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { AuthShell } from "./auth-shell";
import { ApiAlert, LoadingOverlay, Spinner } from "@/components/ui/feedback";
import { InputField, PasswordField } from "@/components/ui/form-controls";
import { useAuth } from "@/context/auth-provider";
import { apiErrorOf, friendlyAuthError } from "@/lib/api/errors";
import { normalizePhone } from "@/lib/phone";
import { publicWebUrl } from "@/lib/site-urls";
import { routeForNextAction } from "@/lib/navigation";
import { safeReturnTo } from "@/lib/return-to";
import { anonymousCustomerAnalyticsDistinctId, trackCustomerEvent } from "@/lib/analytics/customer";
import { loginSchema, type LoginValues } from "@/lib/validation";

export function LoginScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, pendingSignup } = useAuth();
  const [error, setError] = useState("");
  const [routing, setRouting] = useState(false);
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { identifier: "", password: "" } });
  const mutation = useMutation({ mutationFn: async ({ identifier, password }: LoginValues) => login(identifier.includes("@") ? identifier.trim().toLowerCase() : normalizePhone(identifier), password, await anonymousCustomerAnalyticsDistinctId()) });
  const submit = form.handleSubmit(async (values) => {
    setError("");
    void trackCustomerEvent("Login Submitted", { login_identifier_type: values.identifier.includes("@") ? "email" : "phone" });
    try {
      const result = await mutation.mutateAsync(values);
      setRouting(true);
      const returnTo = safeReturnTo(searchParams.get("returnTo"));
      window.setTimeout(() => router.push((returnTo ?? routeForNextAction(result.nextAction)) as import("next").Route), 700);
    } catch (caught) { setError(friendlyAuthError(apiErrorOf(caught))); }
  });

  return <AuthShell intent={pendingSignup?.intent} backHref={publicWebUrl()}><h1 className="page-title">Login back to your account</h1><p className="page-copy">Log in to save homes, message agents and manage your listings.</p><form className="form-stack" onSubmit={submit} noValidate><InputField label="Email address / Phone" autoComplete="username" error={form.formState.errors.identifier?.message} {...form.register("identifier")} /><PasswordField label="Password" autoComplete="current-password" error={form.formState.errors.password?.message} {...form.register("password")} />{error ? <ApiAlert>{error}</ApiAlert> : null}<Link className="text-xs font-bold text-brand-brown" href="/forgot-password">Forgot Password?</Link><button className="btn btn-primary" type="submit" disabled={mutation.isPending}>{mutation.isPending ? <><Spinner />Logging in…</> : "Log in"}</button><p className="text-center text-sm">Don&apos;t have an account? <Link className="font-bold text-brand-brown" href="/signup">Create an account</Link></p></form>{routing ? <LoadingOverlay message="Finding best homes for you..." /> : null}</AuthShell>;
}
