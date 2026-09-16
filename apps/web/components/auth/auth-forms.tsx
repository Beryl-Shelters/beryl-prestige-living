"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { AuthApiError, authRequest } from "../../lib/auth-api";
import { validateNewPassword } from "../../lib/password-policy";
import { loginDestination } from "../../lib/login-destination";
import { useAuthAction } from "./use-auth-action";

import { GoogleAuthButton } from "./google-auth-button";
import { OtpInput } from "./otp-input";
import { PasswordInput } from "./password-input";
import { BrandLoader } from "./brand-loader";
import { showAuthError } from "./toast-provider";

function values(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return Object.fromEntries(new FormData(event.currentTarget));
}

function AuthHeading({ title, children }: { title: string; children?: ReactNode }) {
  return <><h1 className="auth-title">{title}</h1>{children && <p className="auth-copy">{children}</p>}</>;
}

function Divider({ children }: { children: ReactNode }) {
  return <div className="auth-divider"><span>{children}</span></div>;
}

export function LoginForm() {
  const router = useRouter();
  const { pending, run } = useAuthAction();
  function submit(event: FormEvent<HTMLFormElement>) {
    const data = values(event);
    void run(async () => {
      try { await authRequest("/login", { identifier: data.identity, password: data["login-password"] }); }
      catch (failure) {
        if (failure instanceof AuthApiError && failure.code === "EMAIL_NOT_VERIFIED") router.push("/verify-email");
        throw failure;
      }
      router.replace(loginDestination(new URLSearchParams(window.location.search).get("next")));
    });
  }
  return (
    <form className="auth-card" onSubmit={submit} aria-busy={pending}>
      <AuthHeading title="Welcome Back">Ready to continue your journey in real estate? Sign in now to connect with top agents, agencies, and developers who can help you achieve your property goals.</AuthHeading>
      <div className="field-group">
        <label htmlFor="login-identity">Email Address / Phone Number <span aria-hidden="true">*</span></label>
        <input autoComplete="username" id="login-identity" name="identity" placeholder="Enter valid email / phone no." required type="text" />
      </div>
      <PasswordInput autoComplete="current-password" id="login-password" label="Password *" />
      <div className="auth-links split-links">
        <Link href="/verify-email" onClick={(event) => {
          event.preventDefault();
          const input = event.currentTarget.closest("form")?.elements.namedItem("identity") as HTMLInputElement | null;
          if (!input?.reportValidity()) return;
          void run(async () => {
            await authRequest("/resend-verification", { identifier: input.value });
            toast.success("Verification code sent to your email");
            router.push("/verify-email");
          });
        }}>Verify Email</Link>
        <Link href="/forgot-password">Forgot Password</Link>
      </div>
      <button className="button button-primary submit-button" type="submit" disabled={pending}>Submit</button>
      <Divider>or sign in with</Divider>
      <GoogleAuthButton action="sign in" />
    </form>
  );
}

const accountTypes = ["Investor", "Property Developer", "Landlord", "Registered Agent", "Freelance Agent"];

export function RegisterForm() {
  const router = useRouter();
  const { pending, run } = useAuthAction();
  function submit(event: FormEvent<HTMLFormElement>) {
    const data = values(event);
    void run(async () => {
      validateNewPassword(String(data["register-password"] ?? ""), String(data["register-confirm-password"] ?? ""));
      await authRequest("/register", {
        firstName: data.firstName, lastName: data.lastName, email: data.email,
        countryCode: data.countryCode, phoneNumber: data.phone,
        accountType: String(data.accountType).toUpperCase().replaceAll(" ", "_"),
        profileType: String(data.profileType).toUpperCase(),
        password: data["register-password"], confirmPassword: data["register-confirm-password"],
      });
      toast.success("Verification code sent to your email");
      router.push("/verify-email");
    });
  }
  return (
    <form className="auth-card register-card" onSubmit={submit} aria-busy={pending}>
      <AuthHeading title="Create your account">Join Beryl Shelter and begin your property journey.</AuthHeading>
      <div className="two-column-fields">
        <div className="field-group"><label htmlFor="first-name">First Name <span aria-hidden="true">*</span></label><input autoComplete="given-name" id="first-name" name="firstName" placeholder="Enter First Name" required /></div>
        <div className="field-group"><label htmlFor="last-name">Last Name <span aria-hidden="true">*</span></label><input autoComplete="family-name" id="last-name" name="lastName" placeholder="Enter Last Name" required /></div>
      </div>
      <div className="field-group"><label htmlFor="register-email">Email Address <span aria-hidden="true">*</span></label><input autoComplete="email" id="register-email" name="email" placeholder="Enter a valid email address" required type="email" /></div>
      <div className="phone-fields">
        <div className="field-group"><label htmlFor="country-code">Country Code</label><select defaultValue="+234" id="country-code" name="countryCode"><option value="+234">Nigeria (+234)</option><option value="+1">+1</option><option value="+44">+44</option></select></div>
        <div className="field-group phone-number"><label htmlFor="phone-number">Phone Number <span aria-hidden="true">*</span></label><input autoComplete="tel" id="phone-number" inputMode="numeric" name="phone" placeholder="Enter a valid phone no." onInput={(event) => { event.currentTarget.value = event.currentTarget.value.replace(/\D/g, ""); }} pattern="[0-9]*" required type="tel" /></div>
      </div>
      <fieldset className="radio-fieldset"><legend>Account Type</legend><div className="radio-options account-options">{accountTypes.map((accountType) => <label className="radio-option" key={accountType}><input defaultChecked={accountType === "Investor"} name="accountType" type="radio" value={accountType} /><span>{accountType}</span></label>)}</div></fieldset>
      <fieldset className="radio-fieldset"><legend>Profile Type</legend><div className="radio-options"><label className="radio-option"><input defaultChecked name="profileType" type="radio" value="Personal" /><span>Personal</span></label><label className="radio-option"><input name="profileType" type="radio" value="Business" /><span>Business</span></label></div></fieldset>
      <div className="two-column-fields">
        <PasswordInput autoComplete="new-password" id="register-password" label="Create Password *" />
        <PasswordInput autoComplete="new-password" id="register-confirm-password" label="Confirm Password *" />
      </div>
      <button className="button button-primary submit-button" type="submit" disabled={pending}>Create Account</button>
      <Divider>or sign up with</Divider>
      <GoogleAuthButton action="sign up" />
      <p className="auth-footer">Already have an account? <Link href="/login">Login</Link></p>
    </form>
  );
}

export function VerifyEmailForm() {
  const router = useRouter();
  const { pending, run } = useAuthAction();
  const [maskedEmail, setMaskedEmail] = useState("");
  const [contextLoading, setContextLoading] = useState(true);
  function runVerification(action: () => Promise<void>) {
    void run(async () => {
      try { await action(); }
      catch (failure) {
        if (failure instanceof AuthApiError && failure.code === "EMAIL_ALREADY_VERIFIED") {
          setMaskedEmail(""); router.replace("/login");
        }
        throw failure;
      }
    });
  }
  function verifyCode(code: string) {
    runVerification(async () => { await authRequest("/verify-email", { code }); router.replace("/account"); });
  }
  useEffect(() => {
    let active = true;
    void authRequest<{ maskedEmail: string }>("/verification-context")
      .then((data) => { if (active) setMaskedEmail(data.maskedEmail); })
      .catch((failure: Error) => {
        if (!active) return;
        showAuthError(failure, "verification-context-error");
        if (failure instanceof AuthApiError && ["EMAIL_ALREADY_VERIFIED", "VERIFICATION_REQUIRED"].includes(failure.code)) router.replace("/login");
      })
      .finally(() => { if (active) setContextLoading(false); });
    return () => { active = false; };
  }, [router]);
  if (contextLoading) return <BrandLoader />;
  return (
    <form className="auth-card compact-card" aria-busy={pending} onSubmit={(event) => {
      const data = values(event);
      verifyCode(String(data.code ?? ""));
    }}>
      <AuthHeading title="Verify your Account">{maskedEmail && <>Enter the verification code for <strong>{maskedEmail}</strong>.</>}</AuthHeading>
      <label className="otp-label" htmlFor="verify-code">Enter Code <span aria-hidden="true">*</span></label>
      <OtpInput id="verify-code" disabled={pending || !maskedEmail} onComplete={verifyCode} />
      <button className="button button-primary submit-button" type="submit" disabled={pending || !maskedEmail}>Submit</button>
      <button className="text-button" type="button" disabled={pending || !maskedEmail} onClick={() => runVerification(async () => {
        await authRequest("/resend-verification", {}); toast.success("Verification code sent to your email");
      })}>Resend Code</button>
      <p className="auth-footer"><Link href="/login">Back to log in</Link></p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const router = useRouter();
  const { pending, run } = useAuthAction();
  return (
    <form className="auth-card compact-card" aria-busy={pending} onSubmit={(event) => {
      const data = values(event);
      void run(async () => {
        await authRequest("/forgot-password", { identifier: data.identity });
        toast.info("Password reset code sent to your email.");
        router.push("/forgot-password/verify");
      });
    }}>
      <AuthHeading title="Forgot Password?">Enter your email address or phone number and we&apos;ll send you a code to reset your password.</AuthHeading>
      <div className="field-group"><label htmlFor="recovery-identity">Email Address / Phone Number <span aria-hidden="true">*</span></label><input autoComplete="username" id="recovery-identity" name="identity" placeholder="Enter valid email / phone no." required type="text" /></div>
      <button className="button button-primary submit-button" type="submit" disabled={pending}>Submit</button>
      <p className="auth-footer"><Link href="/login">Back to log in</Link></p>
    </form>
  );
}

export function ForgotPasswordVerifyForm() {
  const router = useRouter();
  const { pending, run } = useAuthAction();
  return (
    <form className="auth-card compact-card" aria-busy={pending} onSubmit={(event) => {
      const data = values(event);
      void run(async () => { await authRequest("/verify-recovery", { code: data.code }); router.replace("/reset-password"); });
    }}>
      <AuthHeading title="Otp Verification">Enter the six-digit verification code sent to your email.</AuthHeading>
      <label className="otp-label">Enter Code <span aria-hidden="true">*</span></label>
      <OtpInput />
      <button className="button button-primary submit-button" type="submit" disabled={pending}>Submit</button>
      <button className="text-button" type="button" disabled={pending} onClick={() => void run(async () => {
        await authRequest("/resend-recovery", {}); toast.info("Password reset code sent to your email.");
      })}>Resend Code</button>
      <p className="auth-footer"><Link href="/login">Back to log in</Link></p>
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const { pending, run } = useAuthAction();
  const [ready, setReady] = useState(false);
  const [contextLoading, setContextLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void authRequest("/recovery-context").then(() => { if (active) setReady(true); })
      .catch((failure: Error) => { if (active) showAuthError(failure, "recovery-context-error"); })
      .finally(() => { if (active) setContextLoading(false); });
    return () => { active = false; };
  }, []);
  if (contextLoading) return <BrandLoader />;
  return (
    <form className="auth-card compact-card" aria-busy={pending} onSubmit={(event) => {
      const data = values(event);
      void run(async () => {
        validateNewPassword(String(data["new-password"] ?? ""), String(data["confirm-new-password"] ?? ""));
        await authRequest("/reset-password", { password: data["new-password"], confirmPassword: data["confirm-new-password"] });
        router.replace("/reset-password/success");
      });
    }}>
      <AuthHeading title="Reset Password">Create a new password for your account.</AuthHeading>
      <PasswordInput autoComplete="new-password" id="new-password" label="New Password *" />
      <PasswordInput autoComplete="new-password" id="confirm-new-password" label="Confirm Password *" />
      <button className="button button-primary submit-button" type="submit" disabled={pending || !ready}>Submit</button>
      <p className="auth-footer"><Link href="/login">Back to log in</Link></p>
    </form>
  );
}
