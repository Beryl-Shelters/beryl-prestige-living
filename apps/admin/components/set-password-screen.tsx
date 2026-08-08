"use client";
/* eslint-disable react-hooks/incompatible-library */

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthLayout } from "./auth-layout";
import { FieldError, PasswordField } from "./form-controls";
import { PasswordStrength, passwordChecks } from "./password-strength";
import { errorMessage, postApi } from "@/lib/client-api";

const password = z.string().refine((value) => passwordChecks(value).every(([, pass]) => pass), "Use every password requirement");
const schema = z.object({ newPassword: password, confirmPassword: z.string() }).refine((value) => value.newPassword === value.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" }); type Values = z.infer<typeof schema>;
export function SetPasswordScreen() { const router = useRouter(); const [message, setMessage] = useState(""); const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), mode: "onChange" }); const newPassword = watch("newPassword", ""); const submit = async (values: Values) => { setMessage(""); try { await postApi("/api/admin/set-password", values); setMessage("Password set successfully. You can now log in."); window.setTimeout(() => router.replace("/login"), 900); } catch (error) { setMessage(errorMessage(error, "Unable to set your password.")); } }; return <AuthLayout title="Set your permanent password."><h1 className="page-title">Set a new password</h1><p className="page-copy">Choose a new password for your account. Make it one you&apos;ll remember.</p><form className="form-stack" onSubmit={handleSubmit(submit)} noValidate><PasswordField label="New password" autoComplete="new-password" error={errors.newPassword?.message} {...register("newPassword")} /><PasswordStrength password={newPassword} /><PasswordField label="Confirm new password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register("confirmPassword")} /><FieldError>{errors.confirmPassword?.message}</FieldError>{message ? <p className={message.startsWith("Password set") ? "alert alert-success" : "alert alert-error"} role="alert">{message}</p> : null}<button className="button button-primary" type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving…" : "Save new password"}</button></form></AuthLayout>; }
