import Link from "next/link";

import { AuthLayout } from "../../../components/auth/auth-layout";

export default function ResetPasswordSuccessPage() {
  return (
    <AuthLayout>
      <section className="auth-card success-card">
        <h1 className="auth-title">Successful <span className="success-indicator" aria-hidden="true">✓</span></h1>
        <p className="auth-copy">Your password has been successfully reset!</p>
        <Link className="button button-primary submit-button" href="/login"><span aria-hidden="true">←</span> Back To Log In</Link>
      </section>
    </AuthLayout>
  );
}
