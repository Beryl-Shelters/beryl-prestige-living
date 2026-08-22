import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { Mixpanel } from "mixpanel-react-native";
import type { Persona } from "@/types/auth";

type AnalyticsPersona = "Buyer" | "Seller-Developer";
type OtpContext = "signup" | "forgot_password";
type Event = "Signup Screen Viewed" | "Signup Submitted" | "Verification Screen Viewed" | "OTP Resend Requested" | "OTP Verification Failed" | "Onboarding Wizard Started" | "Buyer Onboarding Completed" | "Seller Onboarding Completed" | "Onboarding Wizard Abandoned" | "Persona Activation Started" | "Persona Switched" | "Login Submitted" | "Forgot Password Requested" | "Logout";
type Properties = {
  "Signup Screen Viewed": { entry_point: "direct" };
  "Signup Submitted": { Initial_Persona: "Find a Property" | "List a Property" };
  "Verification Screen Viewed": { otp_context: OtpContext };
  "OTP Resend Requested": { otp_context: OtpContext; resend_count: number };
  "OTP Verification Failed": { otp_context: OtpContext; attempt_number: number; failure_reason: "invalid" | "expired" };
  "Onboarding Wizard Started": { persona_type: AnalyticsPersona; trigger_source: "signup" | "persona_activation" };
  "Buyer Onboarding Completed": { preferred_locations: string[]; budget_provided: boolean; skipped_budget: boolean };
  "Seller Onboarding Completed": { profile_type: "Individual" | "Business"; company_name_provided: boolean; company_address_provided: boolean };
  "Onboarding Wizard Abandoned": { persona_type: AnalyticsPersona };
  "Persona Activation Started": { target_persona: AnalyticsPersona };
  "Persona Switched": { from_persona: AnalyticsPersona; to_persona: AnalyticsPersona };
  "Login Submitted": { login_identifier_type: "email" | "phone" };
  "Forgot Password Requested": Record<string, never>;
  Logout: { session_duration_sec?: number };
};

const token = process.env.EXPO_PUBLIC_MIXPANEL_CUSTOMER_TOKEN?.trim();
export type MixpanelEnvironment = "Test" | "Production";
export const mobileMixpanelEnvironment = (value = process.env.EXPO_PUBLIC_MIXPANEL_ENVIRONMENT): MixpanelEnvironment =>
  value?.trim().toLowerCase() === "production" ? "Production" : "Test";
export const mobileMixpanelEventName = (event: string, environment = mobileMixpanelEnvironment()) =>
  /^\[(?:Test|Production)\]\s/.test(event) ? event : `[${environment}] ${event}`;
const environment = mobileMixpanelEnvironment();
const platform = Platform.OS === "ios" ? "iOS" : Platform.OS === "android" ? "Android" : undefined;
const appVersion = Constants.expoConfig?.version ?? Constants.nativeAppVersion;
let instance: Mixpanel | null | undefined;
let anonymousId: string | undefined;
let context: Record<string, string> = {};
const once = new Set<string>();
let onboardingSource: "signup" | "persona_activation" = "signup";

export const CUSTOMER_ANALYTICS_DISTINCT_ID_HEADER = "x-beryl-analytics-distinct-id";
export const customerPersonaForAnalytics = (persona: Persona["type"]): AnalyticsPersona => persona === "BUYER" ? "Buyer" : "Seller-Developer";

const analytics = async () => {
  if (instance !== undefined) return instance;
  if (!token || !platform) { instance = null; return instance; }
  try {
    const next = Constants.appOwnership === "expo" ? new Mixpanel(token, false, false, AsyncStorage) : new Mixpanel(token, false, true);
    await next.init(false, { platform, environment, ...(appVersion ? { app_version: appVersion } : {}) }, "https://api-eu.mixpanel.com");
    if (Platform.OS === "ios") next.setFlushOnBackground(true);
    const id = await next.getDistinctId();
    const safe = /^\$device:[A-Za-z0-9_-]{1,120}$/.test(id) ? id : /^[-A-Za-z0-9_]{1,112}$/.test(id) ? `$device:${id}` : undefined;
    if (safe) { await next.identify(safe); anonymousId = safe; }
    instance = next;
  } catch { instance = null; }
  return instance;
};

export const initializeCustomerAnalytics = async () => { await analytics(); };
export const mobileAnalyticsPlatform = () => platform;
export const mobileAnalyticsAppVersion = () => appVersion;
export async function customerAnonymousAnalyticsId() { await analytics(); return anonymousId; }
export async function identifyCustomerAnalytics(accountId: string, activePersona: AnalyticsPersona) {
  context = { account_id: accountId, active_persona: activePersona };
  const client = await analytics();
  if (!client) return;
  try { await client.identify(accountId); client.registerSuperProperties({ platform: platform!, environment, ...(appVersion ? { app_version: appVersion } : {}), ...context }); } catch { /* best-effort telemetry */ }
}
export async function updateCustomerAnalyticsPersona(activePersona: AnalyticsPersona) {
  context = { ...context, active_persona: activePersona };
  const client = await analytics();
  try { client?.registerSuperProperties({ ...context }); } catch { /* best-effort telemetry */ }
}
export async function resetCustomerAnalytics() {
  context = {}; anonymousId = undefined; once.clear(); onboardingSource = "signup";
  const client = await analytics();
  try { client?.reset(); } catch { /* best-effort telemetry */ }
  instance = undefined;
  await analytics();
}
export async function trackCustomerEvent<Name extends Event>(event: Name, properties: Properties[Name]) {
  const client = await analytics();
  try { client?.track(mobileMixpanelEventName(event, environment), { platform: platform!, environment, ...(appVersion ? { app_version: appVersion } : {}), ...context, ...properties }); } catch { /* best-effort telemetry */ }
}
export async function trackCustomerEventOnce<Name extends Event>(key: string, event: Name, properties: Properties[Name]) {
  if (once.has(key)) return; once.add(key); await trackCustomerEvent(event, properties);
}
export const prepareMobileOnboardingAnalytics = (source: "signup" | "persona_activation") => { onboardingSource = source; };
export const consumeMobileOnboardingAnalytics = () => { const source = onboardingSource; onboardingSource = "signup"; return source; };
