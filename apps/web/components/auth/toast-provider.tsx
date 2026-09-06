"use client";

import { useEffect } from "react";
import { ToastContainer, toast } from "react-toastify";

export function ToastProvider() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const demo = new URLSearchParams(window.location.search).get("toast-demo");
    if (demo === "error") toast.error("Invalid credentials.", { toastId: "auth-demo-error" });
    if (demo === "success") toast.success("Verification code sent to your email", { toastId: "auth-demo-success" });
  }, []);

  return <ToastContainer closeButton position="top-right" autoClose={4500} hideProgressBar={false} newestOnTop />;
}
