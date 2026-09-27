"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { adminApi } from "../lib/api";
import { AdminAuthShell } from "./admin-auth-shell";

type Preview = {
  fullName: string;
  email: string;
  department: "TECH" | "MANAGEMENT";
  role: "ADMIN" | "SUPER_ADMIN";
  expiresAt: string;
};

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
      {hidden && <path d="m4 4 16 16" />}
    </svg>
  );
}

function LockIcon() {
  return (
    <span className="admin-auth-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <rect height="9" rx="2" width="14" x="5" y="11" />
        <path d="M8.5 11V8.5a3.5 3.5 0 1 1 7 0V11M12 14.5v2" />
      </svg>
    </span>
  );
}

export function AcceptInvitationForm() {
  const token = useRef("");
  const validationStarted = useRef(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    const hashToken = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    if (hashToken) {
      token.current = hashToken;
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    }
    if (validationStarted.current) return;
    validationStarted.current = true;
    const value = token.current;
    if (!value) {
      queueMicrotask(() => setError("This invitation is invalid or expired."));
      return;
    }
    adminApi<{ invitation: Preview }>("/invitations/validate", {
      method: "POST",
      body: JSON.stringify({ token: value }),
    })
      .then((data) => setPreview(data.invitation))
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "This invitation is invalid or expired.",
        ),
      );
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await adminApi("/invitations/accept", {
        method: "POST",
        body: JSON.stringify({
          token: token.current,
          password: data.get("password"),
          confirmPassword: data.get("confirmPassword"),
        }),
      });
      setDone(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Account setup failed.");
      setPending(false);
    }
  }

  return (
    <AdminAuthShell variant="invitation">
      <section className="admin-auth-form admin-acceptance-panel">
        {done ? (
          <div className="admin-auth-result">
            <span className="admin-auth-icon admin-auth-icon--success" aria-hidden="true">✓</span>
            <div className="admin-auth-heading">
              <span className="admin-auth-kicker">Invitation accepted</span>
              <h1>Account activated</h1>
              <p>Your Admin account is ready.</p>
            </div>
            <a className="admin-auth-submit button-link" href="/login">
              Continue to Admin login
            </a>
          </div>
        ) : (
          <>
            <LockIcon />
            <div className="admin-auth-heading">
              <span className="admin-auth-kicker">Secure account activation</span>
              <h1>Set a new password</h1>
              <p>Choose a secure password to activate your invited Admin account.</p>
            </div>

            {!preview && !error && (
              <p className="auth-form-message" role="status">Validating invitation…</p>
            )}

            {preview && (
              <form onSubmit={submit}>
                <dl className="invite-identity" aria-label="Invited Admin details">
                  <div>
                    <dt>Name</dt>
                    <dd>{preview.fullName}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{preview.email}</dd>
                  </div>
                  <div>
                    <dt>Department</dt>
                    <dd>{preview.department === "TECH" ? "Tech" : "Management"}</dd>
                  </div>
                  <div>
                    <dt>Role</dt>
                    <dd>{preview.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}</dd>
                  </div>
                </dl>

                <label className="admin-auth-field">
                  <span>New Password</span>
                  <span className="admin-password-control">
                    <input
                      autoComplete="new-password"
                      minLength={8}
                      name="password"
                      placeholder="Enter a new password"
                      required
                      type={showPassword ? "text" : "password"}
                    />
                    <button
                      aria-label={showPassword ? "Hide new password" : "Show new password"}
                      className="password-toggle"
                      onClick={() => setShowPassword((visible) => !visible)}
                      type="button"
                    >
                      <EyeIcon hidden={showPassword} />
                    </button>
                  </span>
                </label>

                <label className="admin-auth-field">
                  <span>Confirm New Password</span>
                  <span className="admin-password-control">
                    <input
                      autoComplete="new-password"
                      minLength={8}
                      name="confirmPassword"
                      placeholder="Re-enter your new password"
                      required
                      type={showConfirmation ? "text" : "password"}
                    />
                    <button
                      aria-label={showConfirmation ? "Hide confirmed password" : "Show confirmed password"}
                      className="password-toggle"
                      onClick={() => setShowConfirmation((visible) => !visible)}
                      type="button"
                    >
                      <EyeIcon hidden={showConfirmation} />
                    </button>
                  </span>
                </label>

                <p className="invitation-expiry-note">
                  This invitation is single-use and expires soon.
                </p>

                <button className="admin-auth-submit" disabled={pending} type="submit">
                  {pending ? "Saving…" : "Save new password"}
                </button>
              </form>
            )}

            {error && (
              <p className="form-error auth-form-message" role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </section>
    </AdminAuthShell>
  );
}
