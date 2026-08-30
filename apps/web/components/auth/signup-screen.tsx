"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Home, Search } from "lucide-react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { AuthShell } from "./auth-shell";
import { PasswordStrength } from "./password-strength";
import { ApiAlert, Spinner } from "@/components/ui/feedback";
import { InputField, PasswordField } from "@/components/ui/form-controls";
import { customerApi } from "@/lib/api/client";
import { apiErrorOf, friendlyAuthError } from "@/lib/api/errors";
import type { GettingStartedAs } from "@/lib/contracts";
import { normalizePhone } from "@/lib/phone";
import { publicWebUrl } from "@/lib/site-urls";
import { anonymousCustomerAnalyticsDistinctId, initialPersonaForAnalytics, trackCustomerEvent } from "@/lib/analytics/customer";
import { signupSchema, type SignupValues } from "@/lib/validation";
import { useAuth } from "@/context/auth-provider";

const Link = ({ href, ...props }: ComponentProps<typeof NextLink>) => {
  const isLegalRoute = href === "/privacy" || href === "/terms";
  return <NextLink href={href} {...props} {...(isLegalRoute ? { target: "_blank", rel: "noopener noreferrer" } : {})} />;
};

export function SignupScreen() {
  const trackedView = useRef(false);
  const router = useRouter();
  const { setPendingSignup } = useAuth();
  const [globalError, setGlobalError] = useState("");
  const form = useForm<SignupValues>({ resolver: zodResolver(signupSchema), mode: "onChange", defaultValues: { gettingStartedAs: "FIND_PROPERTY", fullName: "", email: "", phone: "+234", isWhatsAppNumber: true, whatsAppNumber: "", password: "", confirmPassword: "" } });
  const intent = form.watch("gettingStartedAs") as GettingStartedAs;
  const isWhatsApp = form.watch("isWhatsAppNumber");
  const password = form.watch("password");
  const mutation = useMutation({ mutationFn: ({ body, analyticsDistinctId }: { body: Parameters<typeof customerApi.register>[0]; analyticsDistinctId?: string }) => customerApi.register(body, analyticsDistinctId) });

  useEffect(() => {
    if (trackedView.current) return;
    trackedView.current = true;
    void trackCustomerEvent("Signup Screen Viewed", { entry_point: "direct" });
  }, []);

  const submit = form.handleSubmit(async (values) => {
    setGlobalError("");
    void trackCustomerEvent("Signup Submitted", { Initial_Persona: initialPersonaForAnalytics(values.gettingStartedAs) });
    try {
      const normalizedPhone = normalizePhone(values.phone);
      const analyticsDistinctId = await anonymousCustomerAnalyticsDistinctId();
      const response = await mutation.mutateAsync({ body: {
          fullName: values.fullName.trim(),
          email: values.email.trim().toLowerCase(),
          phone: normalizedPhone,
          isWhatsAppNumber: values.isWhatsAppNumber,
          whatsAppNumber: values.isWhatsAppNumber ? normalizedPhone : normalizePhone(values.whatsAppNumber ?? ""),
          gettingStartedAs: values.gettingStartedAs,
          password: values.password,
          confirmPassword: values.confirmPassword
        }, analyticsDistinctId });
      setPendingSignup({ email: values.email.trim().toLowerCase(), maskedEmail: response.data.maskedEmail, intent: values.gettingStartedAs, password: values.password });
      router.push("/verify-email");
    } catch (error) {
      const apiError = apiErrorOf(error);
      const message = friendlyAuthError(apiError);
      if (apiError.code === "EMAIL_ALREADY_REGISTERED") form.setError("email", { message });
      else if (apiError.code === "PHONE_ALREADY_REGISTERED") form.setError("phone", { message });
      else setGlobalError(message);
    }
  });

  return <AuthShell intent={intent} backHref={publicWebUrl()}><h1 className="page-title">Create your account</h1><p className="page-copy">To save homes and message agents, set up a free account. Takes a minute.</p><form className="form-stack" onSubmit={submit} noValidate><fieldset><legend className="field-label mb-2">How would you like to get started?</legend><div className="choice-grid"><button type="button" className="choice-card" data-selected={intent === "FIND_PROPERTY"} aria-pressed={intent === "FIND_PROPERTY"} onClick={() => form.setValue("gettingStartedAs", "FIND_PROPERTY", { shouldValidate: true })}><Search size={17} aria-hidden />Find a property</button><button type="button" className="choice-card" data-selected={intent === "LIST_PROPERTY"} aria-pressed={intent === "LIST_PROPERTY"} onClick={() => form.setValue("gettingStartedAs", "LIST_PROPERTY", { shouldValidate: true })}><Home size={17} aria-hidden />List a property</button></div></fieldset><InputField label="Full name" autoComplete="name" error={form.formState.errors.fullName?.message} {...form.register("fullName")} /><InputField label="Email address" type="email" autoComplete="email" error={form.formState.errors.email?.message} {...form.register("email")} /><InputField label="Phone number" inputMode="tel" autoComplete="tel" error={form.formState.errors.phone?.message} {...form.register("phone")} /><fieldset><legend className="field-label mb-2">Is this your WhatsApp number?</legend><div className="choice-grid"><button type="button" className="choice-card" data-selected={isWhatsApp} aria-pressed={isWhatsApp} onClick={() => form.setValue("isWhatsAppNumber", true, { shouldValidate: true })}>Yes</button><button type="button" className="choice-card" data-selected={!isWhatsApp} aria-pressed={!isWhatsApp} onClick={() => form.setValue("isWhatsAppNumber", false, { shouldValidate: true })}>No</button></div></fieldset>{!isWhatsApp ? <InputField label="WhatsApp number" inputMode="tel" autoComplete="tel" error={form.formState.errors.whatsAppNumber?.message} {...form.register("whatsAppNumber")} /> : null}<PasswordField label="Password" autoComplete="new-password" error={form.formState.errors.password?.message} {...form.register("password")} /><PasswordStrength password={password} /><PasswordField label="Confirm password" autoComplete="new-password" error={form.formState.errors.confirmPassword?.message} {...form.register("confirmPassword")} />{globalError ? <ApiAlert>{globalError}</ApiAlert> : null}<p className="text-xs leading-5 text-brand-muted">By creating an account, you agree to our <Link className="text-blue-600 underline" href="/privacy">Privacy Policy</Link> and <Link className="text-blue-600 underline" href="/terms">Terms and Conditions</Link>.</p><button className="btn btn-primary w-full" disabled={!form.formState.isValid || mutation.isPending} type="submit">{mutation.isPending ? <><Spinner label="Creating account" />Creating account…</> : "Create account"}</button><p className="text-center text-sm">Already have an account? <Link className="font-bold text-brand-brown" href="/login">Log in</Link></p></form></AuthShell>;
}
