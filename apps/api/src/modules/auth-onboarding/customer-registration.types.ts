import { PersonaOnboardingStatus, PersonaType } from "./auth-onboarding.types";

export type RegisterCustomerInput = {
  fullName: string;
  email: string;
  phone: string;
  isWhatsAppNumber: boolean;
  whatsAppNumber?: string | null;
  gettingStartedAs: "FIND_PROPERTY" | "LIST_PROPERTY";
  password: string;
};

export type PendingCustomer = {
  id: string;
  fullName: string;
  email: string;
};

export type ReplaceOtpResult = {
  status: "REPLACED" | "COOLDOWN" | "NOT_ELIGIBLE";
  challengeId?: string;
  userId?: string;
  email?: string;
  fullName?: string;
  resendAvailableAt?: Date;
};

export type VerifyOtpResult = {
  status:
    | "VERIFIED"
    | "INVALID_OTP"
    | "OTP_EXPIRED"
    | "OTP_MAX_ATTEMPTS"
    | "OTP_CONSUMED"
    | "OTP_SUPERSEDED";
  userId?: string;
  accountStatus?: "PENDING_VERIFICATION" | "ACTIVE";
  emailVerified?: boolean;
  activePersona?: PersonaType;
  personas?: PersonaType[];
  onboardingStatus?: PersonaOnboardingStatus;
  nextAction?: string;
  attemptsRemaining?: number;
};

export interface CustomerRegistrationStore {
  findConflict(email: string, phone: string): Promise<"EMAIL" | "PHONE" | null>;
  createPendingCustomer(input: RegisterCustomerInput): Promise<PendingCustomer>;
  deletePendingCustomer(userId: string): Promise<void>;
  replaceVerificationOtp(input: {
    email: string;
    codeHash: string;
    expiresAt: Date;
    resendAvailableAt: Date;
    maxAttempts: number;
    now: Date;
  }): Promise<ReplaceOtpResult>;
  invalidateVerificationOtp(challengeId: string, now: Date): Promise<void>;
  verifyEmailOtp(input: {
    email: string;
    codeHash: string;
    now: Date;
  }): Promise<VerifyOtpResult>;
}

export class CustomerRegistrationConflictError extends Error {
  constructor(readonly conflict: "EMAIL" | "PHONE") {
    super("Customer registration conflict");
  }
}
export class CustomerRegistrationInfrastructureError extends Error {}
