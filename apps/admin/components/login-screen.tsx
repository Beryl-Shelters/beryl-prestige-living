"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { errorMessage, postApi } from "@/lib/client-api";
import type { LoginChallenge } from "@/lib/contracts";
import { PasswordField, FieldError } from "./form-controls";
import { AuthLayout } from "./auth-layout";
const schema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});
type Values = z.infer<typeof schema>;
export function LoginScreen() {
  const router = useRouter();
  const [apiError, setApiError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });
  const submit = async (values: Values) => {
    setApiError("");
    try {
      const response = await postApi<LoginChallenge>("/api/admin/login", {
        ...values,
        email: values.email.trim().toLowerCase(),
      });
      if (!response.data) throw new Error("Missing login challenge");
      sessionStorage.setItem(
        "beryl_admin_login_challenge",
        JSON.stringify({
          challengeId: response.data.challengeId,
          maskedEmail: response.data.maskedEmail,
          resendAvailableIn: response.data.resendAvailableIn,
        }),
      );
      router.push("/verify-otp");
    } catch (error) {
      const code = (error as { code?: string }).code;
      setApiError(
        code === "INVALID_ADMIN_CREDENTIALS"
          ? "Incorrect email or password."
          : errorMessage(error, "Unable to start Admin login."),
      );
    }
  };
  return (
    <AuthLayout title="Administration with confidence." artwork="login">
      <h1 className="page-title">Login to your admin account</h1>
      <p className="page-copy">
        We&apos;ll send a one-time code to your email to confirm it&apos;s you.
      </p>
      <form className="form-stack" onSubmit={handleSubmit(submit)} noValidate>
        <div className="field-wrap">
          <label className="field-label" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            className="form-control"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            {...register("email")}
          />
          <FieldError>{errors.email?.message}</FieldError>
        </div>
        <PasswordField
          label="Password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />
        {apiError ? (
          <p className="alert alert-error" role="alert" aria-live="polite">
            {apiError}
          </p>
        ) : null}
        <button
          className="button button-primary"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Logging in…" : "Log In"}
        </button>
      </form>
    </AuthLayout>
  );
}
