"use client";
/* eslint-disable react-hooks/incompatible-library */

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { errorMessage, requestApi } from "@/lib/client-api";
import { FieldError, PasswordField } from "./form-controls";
import { PasswordStrength, passwordChecks } from "./password-strength";

const strongPassword = z.string().refine((value) => passwordChecks(value).every(([, valid]) => valid), "Use every password requirement");
const schema = z.object({ currentPassword: z.string().min(1, "Enter your current password"), newPassword: strongPassword, confirmPassword: z.string() }).refine((values) => values.newPassword === values.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });
type Values = z.infer<typeof schema>;

export function ChangePasswordScreen() {
  const router = useRouter(); const [message, setMessage] = useState("");
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), mode: "onChange" });
  const newPassword = watch("newPassword", "");
  const submit = async (values: Values) => { setMessage(""); try { await requestApi("/api/admin/change-password", values, "PATCH"); setMessage("Password changed successfully. Please log in again."); window.setTimeout(() => router.replace("/login" as never), 1000); } catch (error) { setMessage(errorMessage(error, "Unable to change your password.")); } };
  return <section className="welcome-card change-password-card"><p className="eyebrow">Security</p><h1>Change password</h1><p>Changing your password signs you out on every device.</p><form className="form-stack" onSubmit={handleSubmit(submit)} noValidate><PasswordField label="Current password" autoComplete="current-password" error={errors.currentPassword?.message} {...register("currentPassword")} /><PasswordField label="New password" autoComplete="new-password" error={errors.newPassword?.message} {...register("newPassword")} /><PasswordStrength password={newPassword} /><PasswordField label="Confirm new password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register("confirmPassword")} /><FieldError>{errors.confirmPassword?.message}</FieldError>{message ? <p className={message.startsWith("Password changed") ? "alert alert-success" : "alert alert-error"} role="status">{message}</p> : null}<button className="button button-primary" type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving…" : "Save new password"}</button></form></section>;
}
