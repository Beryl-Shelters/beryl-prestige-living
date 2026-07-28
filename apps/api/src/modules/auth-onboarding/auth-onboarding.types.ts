export const CUSTOMER_ACCOUNT_STATUSES = [
  "PENDING_VERIFICATION",
  "ACTIVE",
  "SUSPENDED",
  "LOCKED"
] as const;

export const PERSONA_TYPES = ["BUYER", "SELLER_DEVELOPER"] as const;

export const PERSONA_ONBOARDING_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED"
] as const;

export const ADMIN_STATUSES = [
  "PENDING",
  "ACTIVE",
  "SUSPENDED",
  "LOCKED"
] as const;

export const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"] as const;
export const ADMIN_DEPARTMENTS = ["TECH", "MANAGEMENT"] as const;

export const OTP_PURPOSES = [
  "CUSTOMER_EMAIL_VERIFICATION",
  "CUSTOMER_PASSWORD_RESET",
  "ADMIN_ACTIVATION",
  "ADMIN_LOGIN"
] as const;

export const CURRENCIES = ["NGN", "USD", "GBP", "EUR"] as const;
export const PROFILE_TYPES = ["INDIVIDUAL", "BUSINESS"] as const;
export const GETTING_STARTED_AS = ["FIND_PROPERTY", "LIST_PROPERTY"] as const;

export type CustomerAccountStatus = (typeof CUSTOMER_ACCOUNT_STATUSES)[number];
export type PersonaType = (typeof PERSONA_TYPES)[number];
export type PersonaOnboardingStatus =
  (typeof PERSONA_ONBOARDING_STATUSES)[number];
export type AdminStatus = (typeof ADMIN_STATUSES)[number];
export type AdminRole = (typeof ADMIN_ROLES)[number];
export type AdminDepartment = (typeof ADMIN_DEPARTMENTS)[number];
export type OtpPurpose = (typeof OTP_PURPOSES)[number];
export type Currency = (typeof CURRENCIES)[number];
export type ProfileType = (typeof PROFILE_TYPES)[number];

export const personaForGettingStartedAs = {
  FIND_PROPERTY: "BUYER",
  LIST_PROPERTY: "SELLER_DEVELOPER"
} as const satisfies Record<(typeof GETTING_STARTED_AS)[number], PersonaType>;

export type NextRequiredAction =
  | "VERIFY_EMAIL"
  | "COMPLETE_BUYER_ONBOARDING"
  | "COMPLETE_SELLER_ONBOARDING"
  | "CHANGE_PASSWORD"
  | "OPEN_DASHBOARD";
