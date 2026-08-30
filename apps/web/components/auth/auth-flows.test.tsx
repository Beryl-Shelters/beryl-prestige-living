import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "@/test/render";
import { SignupScreen } from "./signup-screen";
import { LoginScreen } from "./login-screen";
import { ForgotPasswordScreen } from "./forgot-password-screen";
import { ResetPasswordScreen } from "./reset-password-screen";
import { VerificationScreen } from "./verification-screen";

const mocks = vi.hoisted(() => ({
  push: vi.fn(), replace: vi.fn(), back: vi.fn(),
  register: vi.fn(), forgot: vi.fn(), verifyEmail: vi.fn(), verifyReset: vi.fn(), resend: vi.fn(), reset: vi.fn(),
  login: vi.fn(), setPendingSignup: vi.fn(), setResetEmail: vi.fn(), track: vi.fn()
}));

let authState: Record<string, unknown>;
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.replace, back: mocks.back }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/context/auth-provider", () => ({ useAuth: () => authState }));
vi.mock("@/lib/api/client", () => ({ customerApi: {
  register: mocks.register,
  forgotPassword: mocks.forgot,
  verifyEmail: mocks.verifyEmail,
  verifyResetOtp: mocks.verifyReset,
  resendVerificationOtp: mocks.resend,
  resetPassword: mocks.reset
} }));
vi.mock("@/lib/analytics/customer", () => ({
  trackCustomerEvent: mocks.track,
  anonymousCustomerAnalyticsDistinctId: () => Promise.resolve("anonymous-test-id"),
  initialPersonaForAnalytics: (persona: "FIND_PROPERTY" | "LIST_PROPERTY") => persona === "FIND_PROPERTY" ? "Find a Property" : "List a Property",
  customerPersonaForAnalytics: (persona: "BUYER" | "SELLER_DEVELOPER") => persona === "BUYER" ? "Buyer" : "Seller-Developer"
}));

const apiFailure = (code: string, message: string, extra: Record<string, unknown> = {}) => Object.assign(new Error(message), { isAxiosError: true, response: { data: { success: false, code, message, ...extra } } });
const registerSuccess = { success: true, message: "Created", data: { verificationRequired: true, maskedEmail: "c•••r@example.com", otpLength: 6, resendAvailableIn: 60, nextAction: "VERIFY_EMAIL" } };

const completeSignup = async () => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/full name/i), "Test Customer");
  await user.type(screen.getByLabelText(/^email address$/i), "customer@example.com");
  await user.clear(screen.getByLabelText(/^phone number$/i));
  await user.type(screen.getByLabelText(/^phone number$/i), "08012345678");
  await user.type(screen.getByLabelText(/^password$/i), "Password123!");
  await user.type(screen.getByLabelText(/confirm password/i), "Password123!");
  return user;
};

describe("customer authentication screens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = { pendingSignup: null, resetEmail: "customer@example.com", login: mocks.login, setPendingSignup: mocks.setPendingSignup, setResetEmail: mocks.setResetEmail };
    mocks.register.mockResolvedValue(registerSuccess);
    mocks.forgot.mockResolvedValue({ success: true, data: { otpLength: 6, resendAvailableIn: 60, nextAction: "VERIFY_PASSWORD_RESET_OTP" } });
    mocks.verifyReset.mockResolvedValue({ success: true, data: { expiresIn: 600, nextAction: "SET_NEW_PASSWORD" } });
    mocks.reset.mockResolvedValue({ success: true, data: { sessionsInvalidated: true, nextAction: "LOGIN" } });
  });

  it("renders signup", () => {
    renderWithQuery(<SignupScreen />);
    expect(screen.getByRole("heading", { name: /create your account/i })).toBeInTheDocument();
  });

  it("opens signup legal links in a new tab without submitting the form", async () => {
    renderWithQuery(<SignupScreen />);
    const privacy = screen.getByRole("link", { name: "Privacy Policy" });
    const terms = screen.getByRole("link", { name: "Terms and Conditions" });

    for (const link of [privacy, terms]) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
      expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
    }
    expect(privacy).toHaveAttribute("href", "/privacy");
    expect(terms).toHaveAttribute("href", "/terms");

    await userEvent.click(privacy);
    await userEvent.click(terms);
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("tracks one safe signup-screen view despite normal re-renders", async () => {
    renderWithQuery(<SignupScreen />);
    await waitFor(() => expect(mocks.track).toHaveBeenCalledWith("Signup Screen Viewed", { entry_point: "direct" }));
    await userEvent.click(screen.getByRole("button", { name: /list a property/i }));
    expect(mocks.track).toHaveBeenCalledTimes(1);
  });

  it("changes persona selection and artwork copy", async () => {
    renderWithQuery(<SignupScreen />);
    await userEvent.click(screen.getByRole("button", { name: /list a property/i }));
    expect(screen.getByText(/reach verified buyers across nigeria/i)).toBeInTheDocument();
  });

  it("shows WhatsApp number only when No is selected", async () => {
    renderWithQuery(<SignupScreen />);
    expect(screen.queryByLabelText(/whatsapp number/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "No" }));
    expect(screen.getByLabelText(/whatsapp number/i)).toBeInTheDocument();
  });

  it("shows confirm-password mismatch", async () => {
    renderWithQuery(<SignupScreen />);
    const user = await completeSignup();
    await user.clear(screen.getByLabelText(/confirm password/i));
    await user.type(screen.getByLabelText(/confirm password/i), "Different123!");
    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeDisabled();
  });

  it("updates password-strength states", async () => {
    renderWithQuery(<SignupScreen />);
    const password = screen.getByLabelText(/^password$/i);
    await userEvent.type(password, "A");
    expect(screen.getByText("Weak")).toBeInTheDocument();
    await userEvent.type(password, "bcdef1!");
    expect(screen.getByText("Strong")).toBeInTheDocument();
  });

  it("routes successful signup to OTP", async () => {
    renderWithQuery(<SignupScreen />);
    const user = await completeSignup();
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/verify-email"));
    expect(mocks.register.mock.calls[0]?.[0]).toEqual({
      fullName: "Test Customer",
      email: "customer@example.com",
      phone: "+2348012345678",
      isWhatsAppNumber: true,
      whatsAppNumber: "+2348012345678",
      gettingStartedAs: "FIND_PROPERTY",
      password: "Password123!",
      confirmPassword: "Password123!"
    });
    expect(mocks.register.mock.calls[0]?.[1]).toBe("anonymous-test-id");
    expect(mocks.setPendingSignup).toHaveBeenCalledWith(expect.objectContaining({ intent: "FIND_PROPERTY", password: "Password123!" }));
    expect(mocks.track).toHaveBeenCalledWith("Signup Submitted", { Initial_Persona: "Find a Property" });
  });

  it("maps duplicate email to the email field", async () => {
    mocks.register.mockRejectedValue(apiFailure("EMAIL_ALREADY_REGISTERED", "duplicate"));
    renderWithQuery(<SignupScreen />);
    const user = await completeSignup();
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/account with this email already exists/i)).toBeInTheDocument();
  });

  it("maps duplicate phone to the phone field", async () => {
    mocks.register.mockRejectedValue(apiFailure("PHONE_ALREADY_REGISTERED", "duplicate"));
    renderWithQuery(<SignupScreen />);
    const user = await completeSignup();
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/account with this phone number already exists/i)).toBeInTheDocument();
  });

  it.each(["customer@example.com", "08012345678"])("logs in with %s", async (identifier) => {
    mocks.login.mockResolvedValue({ nextAction: "OPEN_BUYER_DASHBOARD" });
    renderWithQuery(<LoginScreen />);
    await userEvent.type(screen.getByLabelText(/email address \/ phone/i), identifier);
    await userEvent.type(screen.getByLabelText(/^password$/i), "Password123!");
    await userEvent.click(screen.getByRole("button", { name: /^log in$/i }));
    await waitFor(() => expect(mocks.login).toHaveBeenCalled());
    expect(mocks.login).toHaveBeenCalledWith(identifier.includes("@") ? identifier : "+2348012345678", "Password123!", "anonymous-test-id");
    expect(mocks.track).toHaveBeenCalledWith("Login Submitted", { login_identifier_type: identifier.includes("@") ? "email" : "phone" });
  });

  it.each([
    ["INVALID_CREDENTIALS", "That email/phone or password is not right."],
    ["LOGIN_RATE_LIMITED", "Too many attempts. Try again later or reset your password."]
  ])("renders %s login state", async (code, expected) => {
    mocks.login.mockRejectedValue(apiFailure(code, "unsafe provider text"));
    renderWithQuery(<LoginScreen />);
    await userEvent.type(screen.getByLabelText(/email address \/ phone/i), "customer@example.com");
    await userEvent.type(screen.getByLabelText(/^password$/i), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /^log in$/i }));
    expect(await screen.findByText(expected)).toBeInTheDocument();
  });

  it("submits forgot-password request", async () => {
    renderWithQuery(<ForgotPasswordScreen />);
    await userEvent.type(screen.getByLabelText(/email address/i), "customer@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send reset code/i }));
    await waitFor(() => expect(mocks.forgot.mock.calls[0]?.[0]).toEqual({ email: "customer@example.com" }));
    expect(mocks.push).toHaveBeenCalledWith("/verify-reset-otp");
    expect(mocks.track).toHaveBeenCalledWith("Forgot Password Requested", {});
  });

  it("verifies a reset OTP and routes to reset-password", async () => {
    renderWithQuery(<VerificationScreen mode="reset" />);
    fireEvent.paste(screen.getByRole("group"), { clipboardData: { getData: () => "135790" } });
    expect(await screen.findByText(/code verified/i)).toBeInTheDocument();
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/reset-password"), { timeout: 2000 });
  });

  it("submits password reset through the proof-cookie bridge", async () => {
    renderWithQuery(<ResetPasswordScreen />);
    await userEvent.type(screen.getByLabelText(/^new password$/i), "NewPassword123!");
    await userEvent.type(screen.getByLabelText(/confirm new password/i), "NewPassword123!");
    await userEvent.click(screen.getByRole("button", { name: /save new password/i }));
    await waitFor(() => expect(mocks.reset.mock.calls[0]?.[0]).toEqual({ newPassword: "NewPassword123!", confirmPassword: "NewPassword123!" }));
    expect(mocks.replace).toHaveBeenCalledWith("/login");
  });

  it.each([
    ["INVALID_OTP", "That code was not right. 2 attempts left.", { attemptsRemaining: 2 }],
    ["OTP_EXPIRED", "That code has expired. Request a new one.", {}],
    ["OTP_ATTEMPTS_EXCEEDED", "Too many tries. Request a new code to continue.", {}]
  ])("renders %s reset OTP state", async (code, expected, extra) => {
    mocks.verifyReset.mockRejectedValue(apiFailure(code, "backend", extra));
    renderWithQuery(<VerificationScreen mode="reset" />);
    fireEvent.paste(screen.getByRole("group"), { clipboardData: { getData: () => "135790" } });
    expect(await screen.findByText(expected)).toBeInTheDocument();
    if (code === "INVALID_OTP" || code === "OTP_EXPIRED") expect(mocks.track).toHaveBeenCalledWith("OTP Verification Failed", expect.objectContaining({ otp_context: "forgot_password", failure_reason: code === "INVALID_OTP" ? "invalid" : "expired" }));
  });

  it("disables OTP resend during cooldown", () => {
    renderWithQuery(<VerificationScreen mode="reset" />);
    expect(screen.getByRole("button", { name: /resend code in 0:60/i })).toBeDisabled();
  });
});
