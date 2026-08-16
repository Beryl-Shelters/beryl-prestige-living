import packageJson from "../../package.json";
import type { PersonaType } from "@/lib/contracts";

type CustomerAnalyticsEvent =
  | "Signup Screen Viewed"
  | "Signup Submitted"
  | "Verification Screen Viewed"
  | "OTP Resend Requested"
  | "OTP Verification Failed"
  | "Onboarding Wizard Started"
  | "Buyer Onboarding Completed"
  | "Seller Onboarding Completed"
  | "Persona Activation Started"
  | "Persona Switched"
  | "Login Submitted"
  | "Forgot Password Requested"
  | "Logout";
type CustomerAnalyticsProperties = {
  "Signup Screen Viewed": { entry_point: "direct" };
  "Signup Submitted": { Initial_Persona: "Find a Property" | "List a Property" };
  "Verification Screen Viewed": { otp_context: "signup" | "forgot_password" };
  "OTP Resend Requested": { otp_context: "signup" | "forgot_password"; resend_count: number };
  "OTP Verification Failed": { otp_context: "signup" | "forgot_password"; attempt_number: number; failure_reason: "invalid" | "expired" };
  "Onboarding Wizard Started": { persona_type: CustomerAnalyticsPersona; trigger_source: "signup" | "persona_activation" };
  "Buyer Onboarding Completed": { preferred_locations: string[]; budget_provided: boolean; skipped_budget: boolean };
  "Seller Onboarding Completed": { profile_type: "Individual" | "Business"; company_name_provided: boolean; company_address_provided: boolean };
  "Persona Activation Started": { target_persona: CustomerAnalyticsPersona };
  "Persona Switched": { from_persona: CustomerAnalyticsPersona; to_persona: CustomerAnalyticsPersona };
  "Login Submitted": { login_identifier_type: "email" | "phone" };
  "Forgot Password Requested": Record<string, never>;
  Logout: Record<string, never>;
};

export type CustomerAnalyticsPersona = "Buyer" | "Seller-Developer";
type CustomerAnalyticsContext = {
  account_id?: string;
  active_persona?: CustomerAnalyticsPersona;
};

const customerToken = process.env.NEXT_PUBLIC_MIXPANEL_CUSTOMER_TOKEN?.trim();
export type MixpanelEnvironment = "Test" | "Production";
export const customerMixpanelEnvironment = (value = process.env.NEXT_PUBLIC_MIXPANEL_ENVIRONMENT): MixpanelEnvironment =>
  value?.trim().toLowerCase() === "production" ? "Production" : "Test";
export const customerMixpanelEventName = (event: string, environment = customerMixpanelEnvironment()) =>
  /^\[(?:Test|Production)\]\s/.test(event) ? event : `[${environment}] ${event}`;
const environment = customerMixpanelEnvironment();
const baseProperties = { platform: "Web", app_version: packageJson.version } as const;
let context: CustomerAnalyticsContext = {};
let initialization: Promise<typeof import("mixpanel-browser").default | null> | null = null;

const customerMixpanel = async () => {
  if (typeof window === "undefined" || !customerToken) return null;

  initialization ??= import("mixpanel-browser").then(({ default: mixpanel }) => {
    mixpanel.init(customerToken, {
      api_host: "https://api-eu.mixpanel.com",
      autocapture: false,
      track_pageview: false
    });
    mixpanel.register(baseProperties);
    return mixpanel;
  });

  return initialization;
};

const globalProperties = () => ({ ...baseProperties, environment, ...context });

export const customerPersonaForAnalytics = (persona: PersonaType): CustomerAnalyticsPersona =>
  persona === "BUYER" ? "Buyer" : "Seller-Developer";

export const initialPersonaForAnalytics = (persona: "FIND_PROPERTY" | "LIST_PROPERTY") =>
  persona === "FIND_PROPERTY" ? "Find a Property" : "List a Property";

export async function identifyCustomerAnalytics(accountId: string, activePersona: CustomerAnalyticsPersona) {
  if (!accountId) return;
  context = { account_id: accountId, active_persona: activePersona };
  const mixpanel = await customerMixpanel();
  if (!mixpanel) return;
  mixpanel.identify(accountId);
  mixpanel.register(globalProperties());
}

export async function updateCustomerAnalyticsPersona(activePersona: CustomerAnalyticsPersona) {
  context = { ...context, active_persona: activePersona };
  const mixpanel = await customerMixpanel();
  if (!mixpanel) return;
  mixpanel.register(globalProperties());
}

export async function resetCustomerAnalytics() {
  context = {};
  const mixpanel = await customerMixpanel();
  if (!mixpanel) return;
  mixpanel.reset();
  mixpanel.register(baseProperties);
}

export async function anonymousCustomerAnalyticsDistinctId() {
  const mixpanel = await customerMixpanel();
  const distinctId = mixpanel?.get_distinct_id();
  return typeof distinctId === "string" && /^\$device:[A-Za-z0-9_-]{1,120}$/.test(distinctId)
    ? distinctId
    : undefined;
}

export async function trackCustomerEvent<Event extends CustomerAnalyticsEvent>(
  event: Event,
  properties: CustomerAnalyticsProperties[Event]
) {
  const mixpanel = await customerMixpanel();
  if (!mixpanel) return;
  mixpanel.track(customerMixpanelEventName(event, environment), { ...globalProperties(), ...properties });
}
