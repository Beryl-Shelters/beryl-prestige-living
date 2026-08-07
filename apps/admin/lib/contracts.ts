export type ApiEnvelope<T> = { success: boolean; message: string; code?: string; details?: Record<string, unknown>; data?: T };
export type AdminIdentity = { id: string; fullName: string; email: string; department?: string | null; adminRole: string; status: string; requiresPasswordChange: boolean };
export type AdminSessionState = { admin: AdminIdentity; nextAction: "OPEN_ADMIN_DASHBOARD"; accessTokenExpiresIn: number; refreshTokenExpiresIn: number };
export type LoginChallenge = { challengeId: string; maskedEmail: string; otpLength: 6; resendAvailableIn: number; nextAction: "VERIFY_ADMIN_LOGIN_OTP" };
