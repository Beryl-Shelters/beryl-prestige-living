export type Intent = "FIND_PROPERTY" | "LIST_PROPERTY";
export type VerificationFlow = { email: string; maskedEmail: string; gettingStartedAs: Intent; resendAvailableIn: number };
export type ApiEnvelope<T> = { success: boolean; message: string; data?: T; code?: string; details?: { attemptsRemaining?: number; retryAfter?: number } };
