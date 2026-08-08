"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthLayout } from "./auth-layout";
import { FieldError, PasswordField } from "./form-controls";
import { errorMessage, postApi } from "@/lib/client-api";

const schema = z.object({ temporaryPassword: z.string().min(1, "Enter the temporary password from your invitation email") });
type Values = z.infer<typeof schema>;

export function ActivationScreen({ invitationToken }: { invitationToken: string }) {
  const router = useRouter(); const [apiError, setApiError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) });
  const submit = async ({ temporaryPassword }: Values) => {
    setApiError("");
    try {
      const response = await postApi<{ challengeId: string; maskedEmail: string; resendAvailableIn: number }>("/api/admin/activate", { invitationToken, temporaryPassword });
      if (!response.data) throw new Error("Missing activation challenge");
      sessionStorage.setItem("beryl_admin_activation_challenge", JSON.stringify(response.data));
      router.replace("/activation-otp" as never);
    } catch (error) { setApiError(errorMessage(error, "Unable to activate this invitation.")); }
  };
  return <AuthLayout title="Activate your Admin account."><h1 className="page-title">Activate your account</h1><p className="page-copy">You&apos;ve been invited to the admin portal. Enter the temporary password from your invitation email to continue.</p><form className="form-stack" onSubmit={handleSubmit(submit)} noValidate><PasswordField label="Temporary password" autoComplete="current-password" error={errors.temporaryPassword?.message} {...register("temporaryPassword")} /><FieldError>{errors.temporaryPassword?.message}</FieldError>{apiError ? <p className="alert alert-error" role="alert">{apiError}</p> : null}<button className="button button-primary" type="submit" disabled={isSubmitting}>{isSubmitting ? "Continuing…" : "Continue"}</button></form><p className="auth-footnote">This invitation link is single-use and expires soon.</p></AuthLayout>;
}
