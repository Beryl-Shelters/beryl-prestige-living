import {
  CustomerAccountStatus,
  PersonaOnboardingStatus,
  PersonaType
} from "./auth-onboarding.types";

export type CustomerIdentityState = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  accountStatus: CustomerAccountStatus;
  emailVerified: boolean;
  sessionVersion: number;
  activePersona: PersonaType;
  lastActivePersona: PersonaType;
  personas: Array<{
    type: PersonaType;
    onboardingStatus: PersonaOnboardingStatus;
  }>;
};

export type AccountMutationStatus =
  | "OK"
  | "ACCOUNT_NOT_FOUND"
  | "ACCOUNT_VERIFICATION_REQUIRED"
  | "ACCOUNT_SUSPENDED"
  | "ACCOUNT_LOCKED";

export type SessionMutationStatus =
  | AccountMutationStatus
  | "SESSION_NOT_FOUND"
  | "INVALID_REFRESH_TOKEN"
  | "REFRESH_TOKEN_EXPIRED"
  | "REFRESH_TOKEN_REVOKED"
  | "REFRESH_TOKEN_REUSED";

export type ReplacePasswordResetOtpResult = {
  status: "REPLACED" | "COOLDOWN" | "NOT_ELIGIBLE";
  challengeId?: string;
  userId?: string;
  email?: string;
  fullName?: string;
  resendAvailableAt?: Date;
};

export type VerifyPasswordResetOtpResult = {
  status:
    | "VERIFIED"
    | "INVALID_OTP"
    | "OTP_EXPIRED"
    | "OTP_MAX_ATTEMPTS"
    | "OTP_CONSUMED"
    | "OTP_SUPERSEDED";
  attemptsRemaining?: number;
};

export type ResetPasswordResult = {
  status:
    | "OK"
    | "INVALID_RESET_TOKEN"
    | "RESET_TOKEN_EXPIRED"
    | "RESET_TOKEN_USED"
    | "NEW_PASSWORD_SAME_AS_CURRENT";
};

export type ChangePasswordStatus =
  | AccountMutationStatus
  | "CURRENT_PASSWORD_INCORRECT"
  | "NEW_PASSWORD_SAME_AS_CURRENT";

export interface CustomerAuthenticationStore {
  authenticate(identifier: string, password: string): Promise<string | null>;
  getCustomerState(userId: string): Promise<CustomerIdentityState | null>;
  findCustomerIdByEmail(email: string): Promise<string | null>;
  findCustomerIdByResetProofHash(proofHash: string): Promise<string | null>;
  createSession(input: {
    userId: string;
    sessionId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    now: Date;
  }): Promise<{ status: AccountMutationStatus; sessionVersion?: number }>;
  rotateSession(input: {
    userId: string;
    sessionId: string;
    refreshTokenHash: string;
    replacementSessionId: string;
    replacementRefreshTokenHash: string;
    replacementExpiresAt: Date;
    now: Date;
  }): Promise<{ status: SessionMutationStatus; sessionVersion?: number }>;
  revokeSession(input: {
    userId: string;
    sessionId: string;
    refreshTokenHash: string;
    now: Date;
  }): Promise<{ status: SessionMutationStatus }>;
  replacePasswordResetOtp(input: {
    email: string;
    codeHash: string;
    expiresAt: Date;
    resendAvailableAt: Date;
    maxAttempts: number;
    now: Date;
  }): Promise<ReplacePasswordResetOtpResult>;
  invalidatePasswordResetOtp(challengeId: string, now: Date): Promise<void>;
  verifyPasswordResetOtp(input: {
    email: string;
    codeHash: string;
    proofHash: string;
    proofExpiresAt: Date;
    now: Date;
  }): Promise<VerifyPasswordResetOtpResult>;
  resetPassword(input: {
    proofHash: string;
    newPassword: string;
    now: Date;
  }): Promise<ResetPasswordResult>;
  changePassword(input: {
    userId: string;
    currentPassword: string;
    newPassword: string;
    now: Date;
  }): Promise<{ status: ChangePasswordStatus }>;
}

export class CustomerAuthenticationInfrastructureError extends Error {}
