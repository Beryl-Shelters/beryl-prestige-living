import mixpanel from "mixpanel-browser";
import type { AdminIdentity } from "@/lib/contracts";

type AdminRole = "Admin" | "Super Admin";
type Department = "Tech" | "Management";
type OtpContext = "admin_activation" | "login";
type Event = "Invite Admin Form Viewed" | "Admin Activation Screen Viewed" | "Verification Screen Viewed" | "OTP Resend Requested" | "OTP Verification Failed" | "Login Submitted" | "Logout";
type Properties = {
  "Invite Admin Form Viewed": Record<string, never>;
  "Admin Activation Screen Viewed": Record<string, never>;
  "Verification Screen Viewed": { otp_context: OtpContext };
  "OTP Resend Requested": { otp_context: OtpContext; resend_count: number };
  "OTP Verification Failed": { otp_context: OtpContext; attempt_number: number; failure_reason: "invalid" | "expired" };
  "Login Submitted": Record<string, never>;
  Logout: { session_duration_sec?: number };
};

const token = process.env.NEXT_PUBLIC_MIXPANEL_ADMIN_TOKEN?.trim();
export type MixpanelEnvironment = "Test" | "Production";
export const adminMixpanelEnvironment = (value = process.env.NEXT_PUBLIC_MIXPANEL_ENVIRONMENT): MixpanelEnvironment =>
  value?.trim().toLowerCase() === "production" ? "Production" : "Test";
export const adminMixpanelEventName = (event: string, environment = adminMixpanelEnvironment()) =>
  /^\[(?:Test|Production)\]\s/.test(event) ? event : `[${environment}] ${event}`;
const environment = adminMixpanelEnvironment();
export const ADMIN_ANALYTICS_DISTINCT_ID_HEADER = "x-beryl-analytics-distinct-id";
let initialized = false;
let context: Record<string, string> = {};

export const adminRoleForAnalytics = (role: string): AdminRole | undefined => role === "SUPER_ADMIN" ? "Super Admin" : role === "ADMIN" ? "Admin" : undefined;
export const departmentForAnalytics = (department?: string | null): Department | undefined => department === "TECH" ? "Tech" : department === "MANAGEMENT" ? "Management" : undefined;

const client = () => {
  if (typeof window === "undefined" || !token) return null;
  if (!initialized) { mixpanel.init(token, { api_host: "https://api-eu.mixpanel.com", autocapture: false, track_pageview: false }); initialized = true; mixpanel.register({ platform: "Web", environment }); }
  return mixpanel;
};

export async function identifyAdminAnalytics(admin: AdminIdentity) {
  const role = adminRoleForAnalytics(admin.adminRole); const department = departmentForAnalytics(admin.department);
  if (!role || !department) return;
  context = { admin_role: role, department, account_id: admin.id };
  const instance = client(); if (!instance) return;
  instance.identify(admin.id); instance.register({ platform: "Web", environment, ...context });
}
export async function resetAdminAnalytics() { context = {}; const instance = client(); if (!instance) return; instance.reset(); instance.register({ platform: "Web", environment }); }
export async function trackAdminEvent<Name extends Event>(event: Name, properties: Properties[Name]) { const instance = client(); if (!instance) return; instance.track(adminMixpanelEventName(event, environment), { platform: "Web", environment, ...context, ...properties }); }

export async function adminAnonymousAnalyticsIdentity(): Promise<string | undefined> {
  const instance = client();
  const distinctId = instance?.get_distinct_id();
  return typeof distinctId === "string" && /^\$device:[A-Za-z0-9_-]{1,120}$/.test(distinctId) ? distinctId : undefined;
}
