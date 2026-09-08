"use client";

import { useEffect } from "react";
import { ToastContainer, toast } from "react-toastify";
import { AuthApiError } from "../../lib/auth-api";

export function showAuthError(failure: unknown, toastId?: string) {
  if (failure instanceof AuthApiError && failure.code === "EMAIL_ALREADY_VERIFIED") {
    toast.info("Your email is already verified. Please log in.", toastId ? { toastId } : undefined);
    return;
  }
  let message = failure instanceof Error ? failure.message : "Please try again.";
  if (failure instanceof AuthApiError && failure.code === "GOOGLE_NOT_CONFIGURED") message = "Google sign-in is not available yet.";
  if (failure instanceof AuthApiError && ["CONFIGURATION_UNAVAILABLE", "EMAIL_CONFIRMATION_REQUIRED"].includes(failure.code)) message = "Account services are temporarily unavailable. Please try again.";
  toast.error(message, toastId ? { toastId } : undefined);
}

export function ToastProvider() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const demo = new URLSearchParams(window.location.search).get("toast-demo");
    if (demo === "error") toast.error("Invalid credentials.", { toastId: "auth-demo-error" });
    if (demo === "success") toast.success("Verification code sent to your email", { toastId: "auth-demo-success" });
  }, []);

  return <ToastContainer closeButton position="top-right" autoClose={4500} hideProgressBar={false} newestOnTop />;
}
