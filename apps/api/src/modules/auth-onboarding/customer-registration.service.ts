import { MailService } from "../../services/mail.service";
import { AppError } from "../../utils/AppError";
import { CustomerServerAnalytics, initialPersonaForAnalytics, noOpCustomerServerAnalytics } from "../../analytics/customer-server-analytics";
import { hashOtp, generateSixDigitOtp } from "./otp";
import {
  CustomerRegistrationConflictError,
  CustomerRegistrationInfrastructureError,
  CustomerRegistrationStore,
  RegisterCustomerInput
} from "./customer-registration.types";

type ServiceOptions = {
  otpSecret: string;
  otpExpiryMinutes: number;
  otpResendCooldownSeconds: number;
  otpMaxAttempts: number;
  now?: () => Date;
  generateOtp?: () => string;
};

const duplicateError = (conflict: "EMAIL" | "PHONE") =>
  conflict === "EMAIL"
    ? new AppError(
        "An account with this email already exists. Please log in or reset your password.",
        409,
        "EMAIL_ALREADY_REGISTERED"
      )
    : new AppError(
        "An account with this phone number already exists. Please log in or reset your password.",
        409,
        "PHONE_ALREADY_REGISTERED"
      );

const maskEmail = (email: string) => {
  const [localPart, domain] = email.split("@");
  if (!domain) return "***";
  if (localPart.length <= 1) return `***@${domain}`;
  return `${localPart[0]}***${localPart.at(-1)}@${domain}`;
};

export class CustomerRegistrationService {
  private readonly now: () => Date;
  private readonly generateOtp: () => string;

  constructor(
    private readonly store: CustomerRegistrationStore,
    private readonly mail: MailService,
    private readonly options: ServiceOptions,
    private readonly analytics: CustomerServerAnalytics = noOpCustomerServerAnalytics
  ) {
    this.now = options.now ?? (() => new Date());
    this.generateOtp = options.generateOtp ?? generateSixDigitOtp;
  }

  private requireOtpSecret() {
    if (this.options.otpSecret.length < 32) {
      throw new AppError(
        "Customer verification is temporarily unavailable",
        503,
        "CUSTOMER_AUTH_NOT_CONFIGURED"
      );
    }
  }

  private challengeTimes(now: Date) {
    return {
      expiresAt: new Date(now.getTime() + this.options.otpExpiryMinutes * 60_000),
      resendAvailableAt: new Date(
        now.getTime() + this.options.otpResendCooldownSeconds * 1_000
      )
    };
  }

  async register(input: RegisterCustomerInput, analyticsDistinctId?: string) {
    this.requireOtpSecret();
    let pendingUserId: string | undefined;

    try {
      const conflict = await this.store.findConflict(input.email, input.phone);
      if (conflict) {
        this.analytics.signupBlockedDuplicate(conflict === "EMAIL" ? "email" : "phone", analyticsDistinctId);
        throw duplicateError(conflict);
      }

      const pending = await this.store.createPendingCustomer(input);
      pendingUserId = pending.id;
      this.analytics.accountCreated(pending.id, initialPersonaForAnalytics(input.gettingStartedAs));
      const now = this.now();
      const otp = this.generateOtp();
      const { expiresAt, resendAvailableAt } = this.challengeTimes(now);
      const challenge = await this.store.replaceVerificationOtp({
        email: pending.email,
        codeHash: hashOtp(
          this.options.otpSecret,
          pending.email,
          "CUSTOMER_EMAIL_VERIFICATION",
          otp
        ),
        expiresAt,
        resendAvailableAt,
        maxAttempts: Math.min(Math.max(this.options.otpMaxAttempts, 1), 3),
        now
      });

      if (challenge.status !== "REPLACED" || !challenge.challengeId) {
        throw new CustomerRegistrationInfrastructureError();
      }

      await this.mail.sendRegistrationOtp({
        to: pending.email,
        fullName: pending.fullName,
        otp,
        expiresInMinutes: this.options.otpExpiryMinutes
      });
      this.analytics.otpSent(pending.id, "signup");

      return {
        verificationRequired: true as const,
        maskedEmail: maskEmail(pending.email),
        otpLength: 6 as const,
        resendAvailableIn: this.options.otpResendCooldownSeconds,
        nextAction: "VERIFY_EMAIL" as const
      };
    } catch (error) {
      if (pendingUserId) {
        await this.store.deletePendingCustomer(pendingUserId).catch(() => undefined);
      }
      if (error instanceof AppError) throw error;
      if (error instanceof CustomerRegistrationConflictError) {
        this.analytics.signupBlockedDuplicate(error.conflict === "EMAIL" ? "email" : "phone", analyticsDistinctId);
        throw duplicateError(error.conflict);
      }
      throw new AppError(
        "Unable to complete registration",
        503,
        "REGISTRATION_UNAVAILABLE"
      );
    }
  }

  async verifyEmail(input: { email: string; otp: string }) {
    this.requireOtpSecret();

    try {
      const result = await this.store.verifyEmailOtp({
        email: input.email,
        codeHash: hashOtp(
          this.options.otpSecret,
          input.email,
          "CUSTOMER_EMAIL_VERIFICATION",
          input.otp
        ),
        now: this.now()
      });

      if (result.status === "INVALID_OTP") {
        throw new AppError(
          "Invalid verification code",
          400,
          "INVALID_OTP",
          { attemptsRemaining: result.attemptsRemaining ?? 0 }
        );
      }
      if (result.status === "OTP_EXPIRED") {
        throw new AppError("Verification code has expired", 400, "OTP_EXPIRED");
      }
      if (result.status === "OTP_MAX_ATTEMPTS") {
        throw new AppError(
          "Maximum verification attempts exceeded",
          429,
          "OTP_ATTEMPTS_EXCEEDED"
        );
      }
      if (
        result.status === "OTP_CONSUMED" ||
        result.status === "OTP_SUPERSEDED"
      ) {
        throw new AppError(
          "Verification code is no longer valid. Request a new code.",
          409,
          "OTP_NO_LONGER_VALID"
        );
      }
      if (!result.userId || !result.activePersona || !result.onboardingStatus) {
        throw new CustomerRegistrationInfrastructureError();
      }
      this.analytics.otpVerificationSucceeded(result.userId, "signup");

      return {
        accountStatus: result.accountStatus,
        emailVerified: result.emailVerified,
        activePersona: result.activePersona,
        personas: result.personas ?? [result.activePersona],
        onboardingStatus: result.onboardingStatus,
        nextAction: result.nextAction
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "Unable to verify email",
        503,
        "VERIFICATION_UNAVAILABLE"
      );
    }
  }

  async resendVerificationOtp(input: { email: string }) {
    this.requireOtpSecret();
    const now = this.now();
    const otp = this.generateOtp();
    const { expiresAt, resendAvailableAt } = this.challengeTimes(now);

    try {
      const challenge = await this.store.replaceVerificationOtp({
        email: input.email,
        codeHash: hashOtp(
          this.options.otpSecret,
          input.email,
          "CUSTOMER_EMAIL_VERIFICATION",
          otp
        ),
        expiresAt,
        resendAvailableAt,
        maxAttempts: Math.min(Math.max(this.options.otpMaxAttempts, 1), 3),
        now
      });

      if (
        challenge.status === "COOLDOWN" &&
        challenge.resendAvailableAt
      ) {
        throw new AppError(
          "Please wait before requesting another verification code",
          429,
          "OTP_RESEND_COOLDOWN",
          {
            retryAfter: Math.max(
              1,
              Math.ceil(
                (challenge.resendAvailableAt.getTime() - now.getTime()) / 1_000
              )
            )
          }
        );
      }

      if (
        challenge.status !== "REPLACED" ||
        !challenge.challengeId ||
        !challenge.email ||
        !challenge.fullName
      ) {
        return {
          accepted: true as const,
          resendAvailableIn: this.options.otpResendCooldownSeconds
        };
      }

      try {
        await this.mail.sendRegistrationOtp({
          to: challenge.email,
          fullName: challenge.fullName,
          otp,
          expiresInMinutes: this.options.otpExpiryMinutes
        });
        if (challenge.userId) this.analytics.otpSent(challenge.userId, "signup");
      } catch {
        await this.store.invalidateVerificationOtp(challenge.challengeId, now);
        throw new AppError(
          "Unable to send verification email",
          503,
          "MAIL_DELIVERY_FAILED"
        );
      }

      return {
        accepted: true as const,
        resendAvailableIn: this.options.otpResendCooldownSeconds
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "Unable to process verification request",
        503,
        "VERIFICATION_UNAVAILABLE"
      );
    }
  }
}
