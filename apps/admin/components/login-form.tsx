"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { adminApi } from "../lib/api";
import { AdminAuthShell } from "./admin-auth-shell";

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
      {hidden && <path d="m4 4 16 16" />}
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await adminApi("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: data.get("email"),
          password: data.get("password"),
        }),
      });
      router.replace("/");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Login failed.");
      setPending(false);
    }
  }

  return (
    <AdminAuthShell variant="login">
      <form className="admin-auth-form" onSubmit={submit}>
        <div className="admin-auth-heading">
          <span className="admin-auth-kicker">Welcome back</span>
          <h1>Login to your admin account</h1>
          <p>Secure access for invited Beryl Shelter administrators.</p>
        </div>

        <label className="admin-auth-field">
          <span>Email Address</span>
          <input
            autoComplete="email"
            name="email"
            placeholder="Enter your email address"
            required
            type="email"
          />
        </label>

        <label className="admin-auth-field">
          <span>Password</span>
          <span className="admin-password-control">
            <input
              autoComplete="current-password"
              name="password"
              placeholder="Enter your password"
              required
              type={showPassword ? "text" : "password"}
            />
            <button
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="password-toggle"
              onClick={() => setShowPassword((visible) => !visible)}
              type="button"
            >
              <EyeIcon hidden={showPassword} />
            </button>
          </span>
        </label>

        {error && (
          <p className="form-error auth-form-message" role="alert">
            {error}
          </p>
        )}

        <button className="admin-auth-submit" disabled={pending} type="submit">
          {pending ? "Signing in…" : "Log In"}
        </button>
      </form>
    </AdminAuthShell>
  );
}
