export type Intent = "FIND_PROPERTY" | "LIST_PROPERTY";
export type Persona = { type: "BUYER" | "SELLER_DEVELOPER"; onboardingStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" };
export type VerificationFlow = { email: string; maskedEmail: string; gettingStartedAs: Intent; resendAvailableIn: number; password?: string };
export type ApiEnvelope<T> = { success: boolean; message: string; data?: T; code?: string; details?: { attemptsRemaining?: number; retryAfter?: number } };
export type CustomerSession = { accessToken: string; refreshToken: string; user: { id: string; fullName: string; email: string; phone: string | null; accountStatus: string; emailVerified: boolean } | null; activePersona: Persona["type"]; personas: Persona[]; nextAction: NextAction };
export type NextAction = "COMPLETE_BUYER_ONBOARDING" | "COMPLETE_SELLER_ONBOARDING" | "OPEN_BUYER_DASHBOARD" | "OPEN_SELLER_DASHBOARD";
export type OnboardingStatus = { accountStatus: string; emailVerified: boolean; activePersona: Persona["type"]; lastActivePersona: Persona["type"]; personas: Persona[]; onboardingStatus?: Persona["onboardingStatus"]; nextAction: NextAction; dashboardAccess: boolean; missingOnboardingSteps: string[] };
