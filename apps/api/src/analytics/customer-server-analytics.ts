import Mixpanel from "mixpanel";
import { env } from "../config/env";
import { mixpanelEnvironment, mixpanelEventName } from "./mixpanel-environment";

type CustomerPersona = "Buyer" | "Seller-Developer";
type InitialPersona = "Find a Property" | "List a Property";
type OtpContext = "signup" | "forgot_password";

type MixpanelClient = Pick<ReturnType<typeof Mixpanel.init>, "track">;

export interface CustomerServerAnalytics {
  signupBlockedDuplicate(field: "email" | "phone", distinctId?: string): void;
  accountCreated(accountId: string, initialPersona: InitialPersona): void;
  otpSent(accountId: string, context: OtpContext): void;
  otpVerificationSucceeded(accountId: string | undefined, context: OtpContext): void;
  personaActivated(accountId: string, targetPersona: CustomerPersona): void;
  customerLoggedIn(accountId: string, activePersona: CustomerPersona): void;
  loginFailed(distinctId?: string): void;
  passwordResetOtpVerified(accountId?: string): void;
  passwordResetCompleted(accountId?: string): void;
}

export const noOpCustomerServerAnalytics: CustomerServerAnalytics = {
  signupBlockedDuplicate: () => undefined,
  accountCreated: () => undefined,
  otpSent: () => undefined,
  otpVerificationSucceeded: () => undefined,
  personaActivated: () => undefined,
  customerLoggedIn: () => undefined,
  loginFailed: () => undefined,
  passwordResetOtpVerified: () => undefined,
  passwordResetCompleted: () => undefined
};

const identity = (accountId?: string): Record<string, string> =>
  accountId ? { distinct_id: accountId, account_id: accountId } : {};
const anonymousIdentity = (distinctId: string): Record<string, string> => ({ distinct_id: distinctId });

export const customerPersonaForAnalytics = (persona: "BUYER" | "SELLER_DEVELOPER"): CustomerPersona =>
  persona === "BUYER" ? "Buyer" : "Seller-Developer";

export const initialPersonaForAnalytics = (persona: "FIND_PROPERTY" | "LIST_PROPERTY"): InitialPersona =>
  persona === "FIND_PROPERTY" ? "Find a Property" : "List a Property";

export const createCustomerServerAnalytics = (
  token: string,
  client: MixpanelClient | null = token
    ? Mixpanel.init(token, { host: "api-eu.mixpanel.com", protocol: "https" })
    : null,
  configuredEnvironment = env.mixpanelEnvironment
): CustomerServerAnalytics => {
  if (!client) return noOpCustomerServerAnalytics;

  const environment = mixpanelEnvironment(configuredEnvironment);
  const track = (event: string, properties: Record<string, string | boolean>) => {
    try {
      client.track(mixpanelEventName(event, environment), { ...properties, environment }, () => undefined);
    } catch {
      // Analytics is deliberately best-effort and must never affect customer flows.
    }
  };

  return {
    signupBlockedDuplicate: (field, distinctId) => { if (distinctId) track("Signup Blocked – Duplicate Email/Phone", { ...anonymousIdentity(distinctId), duplicate_field: field }); },
    accountCreated: (accountId, initialPersona) => track("Account Created", { ...identity(accountId), Initial_Persona: initialPersona }),
    otpSent: (accountId, context) => track("OTP Sent", { ...identity(accountId), otp_context: context }),
    otpVerificationSucceeded: (accountId, context) => { if (accountId) track("OTP Verification Succeeded", { ...identity(accountId), otp_context: context }); },
    personaActivated: (accountId, targetPersona) => track("Persona Activated", { ...identity(accountId), target_persona: targetPersona }),
    customerLoggedIn: (accountId, activePersona) => track("Customer Logged In", { ...identity(accountId), active_persona: activePersona }),
    loginFailed: (distinctId) => { if (distinctId) track("Login Failed", { ...anonymousIdentity(distinctId), failure_reason: "generic" }); },
    passwordResetOtpVerified: (accountId) => { if (accountId) track("Password Reset OTP Verified", identity(accountId)); },
    passwordResetCompleted: (accountId) => { if (accountId) track("Password Reset Completed", identity(accountId)); }
  };
};

export const customerServerAnalytics = createCustomerServerAnalytics(
  env.mixpanelCustomerToken
);
