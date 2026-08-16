import { randomUUID } from "node:crypto";
import { MailService } from "../../services/mail.service";
import { AppError } from "../../utils/AppError";
import { CustomerServerAnalytics, customerPersonaForAnalytics, noOpCustomerServerAnalytics } from "../../analytics/customer-server-analytics";
import { nextActionFor } from "./customer-onboarding.service";
import {
  AccountMutationStatus,
  CustomerAuthenticationInfrastructureError,
  CustomerAuthenticationStore,
  SessionMutationStatus
} from "./customer-authentication.types";
import { generateSixDigitOtp, hashOtp } from "./otp";
import {
  createResetProof,
  CustomerTokenError,
  hashToken,
  issueCustomerAccessToken,
  issueCustomerRefreshToken,
  verifyCustomerRefreshToken
} from "./customer-session.tokens";

type CustomerAuthenticationOptions = {
  otpSecret: string;
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
  otpExpiryMinutes: number;
  otpResendCooldownSeconds: number;
  otpMaxAttempts: number;
  resetProofExpiresIn: number;
  now?: () => Date;
  generateOtp?: () => string;
};

const accountError = (status: AccountMutationStatus): AppError => {
  switch (status) {
    case "ACCOUNT_VERIFICATION_REQUIRED":
      return new AppError(
        "Account verification is required",
        403,
        "ACCOUNT_VERIFICATION_REQUIRED"
      );
    case "ACCOUNT_SUSPENDED":
      return new AppError("Account is suspended", 403, "ACCOUNT_SUSPENDED");
    case "ACCOUNT_LOCKED":
      return new AppError("Account is locked", 423, "ACCOUNT_LOCKED");
    default:
      return new AppError(
        "Incorrect email/phone or password",
        401,
        "INVALID_CREDENTIALS"
      );
  }
};

const refreshError = (status: SessionMutationStatus) => {
  switch (status) {
    case "REFRESH_TOKEN_EXPIRED":
      return new AppError("Refresh token has expired", 401, status);
    case "REFRESH_TOKEN_REVOKED":
      return new AppError("Refresh token has been revoked", 401, status);
    case "REFRESH_TOKEN_REUSED":
      return new AppError(
        "Refresh token reuse detected; sessions have been revoked",
        401,
        status
      );
    case "SESSION_NOT_FOUND":
      return new AppError("Customer session was not found", 401, status);
    case "ACCOUNT_VERIFICATION_REQUIRED":
    case "ACCOUNT_SUSPENDED":
    case "ACCOUNT_LOCKED":
    case "ACCOUNT_NOT_FOUND":
      return accountError(status);
    default:
      return new AppError("Invalid refresh token", 401, "INVALID_REFRESH_TOKEN");
  }
};

export class CustomerAuthenticationService {
  private readonly now: () => Date;
  private readonly generateOtp: () => string;

  constructor(
    private readonly store: CustomerAuthenticationStore,
    private readonly mail: MailService,
    private readonly options: CustomerAuthenticationOptions,
    private readonly analytics: CustomerServerAnalytics = noOpCustomerServerAnalytics
  ) {
    this.now = options.now ?? (() => new Date());
    this.generateOtp = options.generateOtp ?? generateSixDigitOtp;
  }

  private requireSessionConfiguration() {
    if (
      this.options.accessTokenSecret.length < 32 ||
      this.options.refreshTokenSecret.length < 32 ||
      this.options.accessTokenSecret === this.options.refreshTokenSecret ||
      this.options.accessTokenExpiresIn <= 0 ||
      this.options.refreshTokenExpiresIn <= 0
    ) {
      throw new AppError(
        "Customer authentication is temporarily unavailable",
        503,
        "CUSTOMER_AUTH_NOT_CONFIGURED"
      );
    }
  }

  private requirePasswordResetConfiguration() {
    if (
      this.options.otpSecret.length < 32 ||
      this.options.resetProofExpiresIn <= 0
    ) {
      throw new AppError(
        "Password reset is temporarily unavailable",
        503,
        "PASSWORD_RESET_UNAVAILABLE"
      );
    }
  }

  private async safely<T>(
    operation: () => Promise<T>,
    message: string,
    code: string
  ) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof CustomerAuthenticationInfrastructureError) {
        throw new AppError(message, 503, code);
      }
      throw error;
    }
  }

  async login(input: { identifier: string; password: string }, analyticsDistinctId?: string) {
    this.requireSessionConfiguration();
    return this.safely(async () => {
      const userId = await this.store.authenticate(input.identifier, input.password);
      if (!userId) {
        this.analytics.loginFailed(analyticsDistinctId);
        throw accountError("ACCOUNT_NOT_FOUND");
      }

      const state = await this.store.getCustomerState(userId);
      if (!state) throw accountError("ACCOUNT_NOT_FOUND");
      if (!state.emailVerified || state.accountStatus === "PENDING_VERIFICATION") {
        throw accountError("ACCOUNT_VERIFICATION_REQUIRED");
      }
      if (state.accountStatus === "SUSPENDED") {
        throw accountError("ACCOUNT_SUSPENDED");
      }
      if (state.accountStatus === "LOCKED") {
        throw accountError("ACCOUNT_LOCKED");
      }

      const restoredPersona =
        state.personas.find((persona) => persona.type === state.lastActivePersona) ??
        state.personas.find((persona) => persona.type === state.activePersona) ??
        state.personas[0];
      if (!restoredPersona) throw accountError("ACCOUNT_NOT_FOUND");

      const now = this.now();
      const sessionId = randomUUID();
      const refreshToken = issueCustomerRefreshToken({
        secret: this.options.refreshTokenSecret,
        userId,
        sessionId,
        expiresIn: this.options.refreshTokenExpiresIn,
        now
      });
      const session = await this.store.createSession({
        userId,
        sessionId,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: new Date(
          now.getTime() + this.options.refreshTokenExpiresIn * 1_000
        ),
        now
      });
      if (session.status !== "OK") throw accountError(session.status);
      const sessionVersion = session.sessionVersion ?? state.sessionVersion;
      const accessToken = issueCustomerAccessToken({
        secret: this.options.accessTokenSecret,
        userId,
        sessionId,
        sessionVersion,
        expiresIn: this.options.accessTokenExpiresIn,
        now
      });
      this.analytics.customerLoggedIn(state.id, customerPersonaForAnalytics(restoredPersona.type));

      return {
        user: {
          id: state.id,
          fullName: state.fullName,
          email: state.email,
          phone: state.phone,
          accountStatus: state.accountStatus,
          emailVerified: state.emailVerified
        },
        activePersona: restoredPersona.type,
        personas: state.personas,
        nextAction: nextActionFor(
          restoredPersona.type,
          restoredPersona.onboardingStatus
        ),
        accessToken,
        refreshToken,
        accessTokenExpiresIn: this.options.accessTokenExpiresIn,
        refreshTokenExpiresIn: this.options.refreshTokenExpiresIn
      };
    }, "Customer login is temporarily unavailable", "LOGIN_UNAVAILABLE");
  }

  async refresh(refreshToken: string) {
    this.requireSessionConfiguration();
    return this.safely(async () => {
      let claims;
      try {
        claims = verifyCustomerRefreshToken(
          refreshToken,
          this.options.refreshTokenSecret,
          this.now()
        );
      } catch (error) {
        throw error instanceof CustomerTokenError && error.reason === "EXPIRED"
          ? refreshError("REFRESH_TOKEN_EXPIRED")
          : refreshError("INVALID_REFRESH_TOKEN");
      }

      const now = this.now();
      const replacementSessionId = randomUUID();
      const replacementRefreshToken = issueCustomerRefreshToken({
        secret: this.options.refreshTokenSecret,
        userId: claims.sub,
        sessionId: replacementSessionId,
        expiresIn: this.options.refreshTokenExpiresIn,
        now
      });
      const result = await this.store.rotateSession({
        userId: claims.sub,
        sessionId: claims.sid,
        refreshTokenHash: hashToken(refreshToken),
        replacementSessionId,
        replacementRefreshTokenHash: hashToken(replacementRefreshToken),
        replacementExpiresAt: new Date(
          now.getTime() + this.options.refreshTokenExpiresIn * 1_000
        ),
        now
      });
      if (result.status !== "OK" || !result.sessionVersion) {
        throw refreshError(result.status);
      }

      return {
        accessToken: issueCustomerAccessToken({
          secret: this.options.accessTokenSecret,
          userId: claims.sub,
          sessionId: replacementSessionId,
          sessionVersion: result.sessionVersion,
          expiresIn: this.options.accessTokenExpiresIn,
          now
        }),
        refreshToken: replacementRefreshToken,
        accessTokenExpiresIn: this.options.accessTokenExpiresIn,
        refreshTokenExpiresIn: this.options.refreshTokenExpiresIn
      };
    }, "Session refresh is temporarily unavailable", "SESSION_REFRESH_UNAVAILABLE");
  }

  async logout(
    session: { userId: string; sessionId: string },
    refreshToken: string
  ) {
    this.requireSessionConfiguration();
    return this.safely(async () => {
      let claims;
      try {
        claims = verifyCustomerRefreshToken(
          refreshToken,
          this.options.refreshTokenSecret,
          this.now()
        );
      } catch {
        throw refreshError("INVALID_REFRESH_TOKEN");
      }
      if (claims.sub !== session.userId || claims.sid !== session.sessionId) {
        throw refreshError("INVALID_REFRESH_TOKEN");
      }

      const result = await this.store.revokeSession({
        userId: session.userId,
        sessionId: session.sessionId,
        refreshTokenHash: hashToken(refreshToken),
        now: this.now()
      });
      if (result.status !== "OK") throw refreshError(result.status);
      return { revoked: true as const };
    }, "Logout is temporarily unavailable", "LOGOUT_UNAVAILABLE");
  }

  async forgotPassword(email: string) {
    this.requirePasswordResetConfiguration();
    return this.safely(async () => {
      const now = this.now();
      const otp = this.generateOtp();
      const challenge = await this.store.replacePasswordResetOtp({
        email,
        codeHash: hashOtp(
          this.options.otpSecret,
          email,
          "CUSTOMER_PASSWORD_RESET",
          otp
        ),
        expiresAt: new Date(now.getTime() + this.options.otpExpiryMinutes * 60_000),
        resendAvailableAt: new Date(
          now.getTime() + this.options.otpResendCooldownSeconds * 1_000
        ),
        maxAttempts: Math.min(Math.max(this.options.otpMaxAttempts, 1), 3),
        now
      });

      if (
        challenge.status === "REPLACED" &&
        challenge.challengeId &&
        challenge.email &&
        challenge.fullName
      ) {
        try {
          await this.mail.sendPasswordResetOtp({
            to: challenge.email,
            fullName: challenge.fullName,
            otp,
            expiresInMinutes: this.options.otpExpiryMinutes
          });
          if (challenge.userId) this.analytics.otpSent(challenge.userId, "forgot_password");
        } catch {
          await this.store
            .invalidatePasswordResetOtp(challenge.challengeId, now)
            .catch(() => undefined);
          throw new AppError(
            "Unable to send password-reset email",
            503,
            "MAIL_DELIVERY_FAILED"
          );
        }
      }

      return {
        otpLength: 6 as const,
        resendAvailableIn: this.options.otpResendCooldownSeconds,
        nextAction: "VERIFY_PASSWORD_RESET_OTP" as const
      };
    }, "Password reset is temporarily unavailable", "PASSWORD_RESET_UNAVAILABLE");
  }

  async verifyPasswordResetOtp(input: { email: string; otp: string }) {
    this.requirePasswordResetConfiguration();
    return this.safely(async () => {
      const now = this.now();
      const resetToken = createResetProof();
      const result = await this.store.verifyPasswordResetOtp({
        email: input.email,
        codeHash: hashOtp(
          this.options.otpSecret,
          input.email,
          "CUSTOMER_PASSWORD_RESET",
          input.otp
        ),
        proofHash: hashToken(resetToken),
        proofExpiresAt: new Date(
          now.getTime() + this.options.resetProofExpiresIn * 1_000
        ),
        now
      });

      if (result.status === "INVALID_OTP") {
        throw new AppError("Invalid verification code", 400, "INVALID_OTP", {
          attemptsRemaining: result.attemptsRemaining ?? 0
        });
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
      if (result.status === "OTP_CONSUMED" || result.status === "OTP_SUPERSEDED") {
        throw new AppError(
          "Verification code is no longer valid. Request a new code.",
          409,
          "OTP_NO_LONGER_VALID"
        );
      }

      const accountId = await this.store.findCustomerIdByEmail(input.email).catch(() => null);
      this.analytics.otpVerificationSucceeded(accountId ?? undefined, "forgot_password");
      this.analytics.passwordResetOtpVerified(accountId ?? undefined);

      return {
        resetToken,
        expiresIn: this.options.resetProofExpiresIn,
        nextAction: "SET_NEW_PASSWORD" as const
      };
    }, "Password reset is temporarily unavailable", "PASSWORD_RESET_UNAVAILABLE");
  }

  async resetPassword(resetToken: string, newPassword: string) {
    this.requirePasswordResetConfiguration();
    return this.safely(async () => {
      const result = await this.store.resetPassword({
        proofHash: hashToken(resetToken),
        newPassword,
        now: this.now()
      });
      if (result.status === "INVALID_RESET_TOKEN") {
        throw new AppError("Invalid password-reset token", 401, result.status);
      }
      if (result.status === "RESET_TOKEN_EXPIRED") {
        throw new AppError("Password-reset token has expired", 401, result.status);
      }
      if (result.status === "RESET_TOKEN_USED") {
        throw new AppError("Password-reset token has already been used", 409, result.status);
      }
      if (result.status === "NEW_PASSWORD_SAME_AS_CURRENT") {
        throw new AppError(
          "New password must differ from current password",
          400,
          result.status
        );
      }
      const accountId = await this.store.findCustomerIdByResetProofHash(hashToken(resetToken)).catch(() => null);
      this.analytics.passwordResetCompleted(accountId ?? undefined);
      return { sessionsInvalidated: true as const, nextAction: "LOGIN" as const };
    }, "Password reset is temporarily unavailable", "PASSWORD_RESET_UNAVAILABLE");
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ) {
    this.requireSessionConfiguration();
    return this.safely(async () => {
      const state = await this.store.getCustomerState(userId);
      if (!state) throw accountError("ACCOUNT_NOT_FOUND");
      if (currentPassword === newPassword) {
        throw new AppError(
          "New password must differ from current password",
          400,
          "NEW_PASSWORD_SAME_AS_CURRENT"
        );
      }

      const result = await this.store.changePassword({
        userId,
        currentPassword,
        newPassword,
        now: this.now()
      });
      if (result.status === "CURRENT_PASSWORD_INCORRECT") {
        throw new AppError(
          "Current password is incorrect",
          401,
          "CURRENT_PASSWORD_INCORRECT"
        );
      }
      if (result.status === "NEW_PASSWORD_SAME_AS_CURRENT") {
        throw new AppError(
          "New password must differ from current password",
          400,
          "NEW_PASSWORD_SAME_AS_CURRENT"
        );
      }
      if (result.status !== "OK") throw accountError(result.status);
      return { sessionsInvalidated: true as const, nextAction: "LOGIN" as const };
    }, "Password change is temporarily unavailable", "PASSWORD_CHANGE_UNAVAILABLE");
  }
}
