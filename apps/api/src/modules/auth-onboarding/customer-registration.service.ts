import { MailService } from "../../services/mail.service";
import { AppError } from "../../utils/AppError";
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

const duplicateError = () =>
  new AppError(
    "An account with these details already exists. Please log in or reset your password.",
    409,
    "ACCOUNT_ALREADY_EXISTS"
  );

export class CustomerRegistrationService {
  private readonly now: () => Date;
  private readonly generateOtp: () => string;

  constructor(
    private readonly store: CustomerRegistrationStore,
    private readonly mail: MailService,
    private readonly options: ServiceOptions
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

  async register(input: RegisterCustomerInput) {
    this.requireOtpSecret();
    let pendingUserId: string | undefined;

    try {
      if (await this.store.findConflict(input.email, input.phone)) {
        throw duplicateError();
      }

      const pending = await this.store.createPendingCustomer(input);
      pendingUserId = pending.id;
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

      return {
        accountId: pending.id,
        accountStatus: "PENDING_VERIFICATION" as const,
        emailVerified: false,
        nextAction: "VERIFY_EMAIL" as const
      };
    } catch (error) {
      if (pendingUserId) {
        await this.store.deletePendingCustomer(pendingUserId).catch(() => undefined);
      }
      if (error instanceof AppError) throw error;
      if (error instanceof CustomerRegistrationConflictError) throw duplicateError();
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
        throw new AppError("Invalid verification code", 400, "INVALID_OTP");
      }
      if (result.status === "OTP_EXPIRED") {
        throw new AppError("Verification code has expired", 400, "OTP_EXPIRED");
      }
      if (result.status === "OTP_MAX_ATTEMPTS") {
        throw new AppError(
          "Maximum verification attempts exceeded",
          429,
          "OTP_MAX_ATTEMPTS"
        );
      }
      if (result.status === "OTP_CONSUMED") {
        throw new AppError("Verification code has already been used", 409, "OTP_CONSUMED");
      }
      if (result.status === "OTP_SUPERSEDED") {
        throw new AppError(
          "Verification code is no longer valid",
          400,
          "OTP_SUPERSEDED"
        );
      }
      if (!result.userId || !result.activePersona || !result.onboardingStatus) {
        throw new CustomerRegistrationInfrastructureError();
      }

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
        challenge.status !== "REPLACED" ||
        !challenge.challengeId ||
        !challenge.email ||
        !challenge.fullName
      ) {
        return { accepted: true as const };
      }

      try {
        await this.mail.sendRegistrationOtp({
          to: challenge.email,
          fullName: challenge.fullName,
          otp,
          expiresInMinutes: this.options.otpExpiryMinutes
        });
      } catch {
        await this.store.invalidateVerificationOtp(challenge.challengeId, now);
        throw new AppError(
          "Unable to send verification email",
          503,
          "MAIL_DELIVERY_FAILED"
        );
      }

      return { accepted: true as const };
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
