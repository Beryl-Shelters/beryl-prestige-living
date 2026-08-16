import Mixpanel from "mixpanel";
import { env } from "../config/env";
import { mixpanelEnvironment, mixpanelEventName } from "./mixpanel-environment";

type Role = "Admin" | "Super Admin";
type Department = "Tech" | "Management";
type OtpContext = "admin_activation" | "login";
type MixpanelClient = Pick<ReturnType<typeof Mixpanel.init>, "track">;

export type AdminAnalyticsIdentity = { id: string; adminRole?: string; department?: string | null };
export interface AdminServerAnalytics {
  invitationBlockedDuplicate(actorId: string): void;
  adminInvited(actorId: string, department: string, role: string): void;
  invitationResent(actorId: string): void;
  accountActivated(admin: AdminAnalyticsIdentity): void;
  otpSent(admin: AdminAnalyticsIdentity, context: OtpContext): void;
  otpVerificationSucceeded(admin: AdminAnalyticsIdentity, context: OtpContext): void;
  loginSuccee(anonymousId?: string, admin?: AdminAnalyticsIdentity): void;
  loginFailed(anonymousId?: string): void;
  adminLoggedIn(admin: AdminAnalyticsIdentity): void;
}

export const noOpAdminServerAnalytics: AdminServerAnalytics = {
  invitationBlockedDuplicate: () => undefined, adminInvited: () => undefined, invitationResent: () => undefined,
  accountActivated: () => undefined, otpSent: () => undefined, otpVerificationSucceeded: () => undefined,
  loginSuccee: () => undefined, loginFailed: () => undefined, adminLoggedIn: () => undefined
};

export const adminRoleForAnalytics = (role?: string): Role | undefined => role === "ADMIN" ? "Admin" : role === "SUPER_ADMIN" ? "Super Admin" : undefined;
export const adminDepartmentForAnalytics = (department?: string | null): Department | undefined => department === "TECH" ? "Tech" : department === "MANAGEMENT" ? "Management" : undefined;

export const createAdminServerAnalytics = (token: string, client: MixpanelClient | null = token ? Mixpanel.init(token, { host: "api-eu.mixpanel.com", protocol: "https" }) : null, configuredEnvironment = env.mixpanelEnvironment): AdminServerAnalytics => {
  if (!client) return noOpAdminServerAnalytics;
  const environment = mixpanelEnvironment(configuredEnvironment);
  const track = (event: string, properties: Record<string, string>) => { try { client.track(mixpanelEventName(event, environment), { ...properties, environment }, () => undefined); } catch { /* telemetry is best-effort */ } };
  const identity = (admin: AdminAnalyticsIdentity) => ({ distinct_id: admin.id, account_id: admin.id, ...(adminRoleForAnalytics(admin.adminRole) ? { admin_role: adminRoleForAnalytics(admin.adminRole)! } : {}), ...(adminDepartmentForAnalytics(admin.department) ? { department: adminDepartmentForAnalytics(admin.department)! } : {}) });
  return {
    invitationBlockedDuplicate: (actorId) => track("Admin Invitation Blocked – Duplicate", { distinct_id: actorId, account_id: actorId }),
    adminInvited: (actorId, department, role) => { const invitee_department = adminDepartmentForAnalytics(department); const invitee_role = adminRoleForAnalytics(role); if (invitee_department && invitee_role) track("Admin Invited", { distinct_id: actorId, account_id: actorId, invitee_department, invitee_role }); },
    invitationResent: (actorId) => track("Admin Invitation Resent", { distinct_id: actorId, account_id: actorId }),
    accountActivated: (admin) => track("Admin Account Activated", identity(admin)),
    otpSent: (admin, otp_context) => track("OTP Sent", { ...identity(admin), otp_context }),
    otpVerificationSucceeded: (admin, otp_context) => track("OTP Verification Succeeded", { ...identity(admin), otp_context }),
    loginSuccee: (anonymousId, admin) => { if (anonymousId) track("Login Succee", { distinct_id: anonymousId }); else if (admin) track("Login Succee", identity(admin)); },
    loginFailed: (anonymousId) => { if (anonymousId) track("Login Failed", { distinct_id: anonymousId, failure_reason: "generic" }); },
    adminLoggedIn: (admin) => track("Admin Logged In", identity(admin))
  };
};

export const adminServerAnalytics = createAdminServerAnalytics(env.mixpanelAdminToken);
