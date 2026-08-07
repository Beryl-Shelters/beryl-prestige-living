import { supabaseAdmin } from "../../config/supabase";
import { AdminDepartment, AdminRole, AdminStatus } from "../auth-onboarding/auth-onboarding.types";

export type AdminRecord = { id: string; full_name: string; email: string; phone: string | null; department: AdminDepartment; admin_role: AdminRole; status: AdminStatus; password_hash: string; requires_password_change: boolean; session_version: number; last_login_at: string | null; created_at: string; updated_at: string };
const fail = () => new Error("Admin authentication storage failed");
const row = (data: unknown) => data as Record<string, unknown>;

export class SupabaseAdminAuthStore {
  async findAdminByEmail(email: string) {
    const result = await supabaseAdmin.from("admins").select("*").eq("email", email).maybeSingle();
    if (result.error) throw fail();
    return result.data as AdminRecord | null;
  }
  async findAdminById(id: string) {
    const result = await supabaseAdmin.from("admins").select("*").eq("id", id).maybeSingle();
    if (result.error) throw fail();
    return result.data as AdminRecord | null;
  }
  async createInvitation(input: { adminId: string; invitedByAdminId: string; fullName: string; email: string; phone: string | null; department: AdminDepartment; role: AdminRole; passwordHash: string; tokenHash: string; expiresAt: Date; now: Date }) {
    const result = await supabaseAdmin.rpc("create_admin_invitation", { p_admin_id: input.adminId, p_invited_by_admin_id: input.invitedByAdminId, p_full_name: input.fullName, p_email: input.email, p_phone: input.phone, p_department: input.department, p_admin_role: input.role, p_password_hash: input.passwordHash, p_token_hash: input.tokenHash, p_expires_at: input.expiresAt.toISOString(), p_now: input.now.toISOString() }).single();
    if (result.error || !result.data) throw fail();
    return row(result.data);
  }
  async replaceInvitation(input: { adminId: string; invitedByAdminId: string; passwordHash: string; tokenHash: string; expiresAt: Date; allowActive?: boolean; now: Date }) {
    const result = await supabaseAdmin.rpc("replace_admin_invitation", { p_admin_id: input.adminId, p_invited_by_admin_id: input.invitedByAdminId, p_password_hash: input.passwordHash, p_token_hash: input.tokenHash, p_expires_at: input.expiresAt.toISOString(), p_allow_active: input.allowActive ?? false, p_now: input.now.toISOString() }).single();
    if (result.error || !result.data) throw fail();
    return row(result.data);
  }
  async findInvitationByTokenHash(tokenHash: string) {
    const result = await supabaseAdmin.from("admin_invitations").select("*, admin:admins(*)").eq("token_hash", tokenHash).maybeSingle();
    if (result.error) throw fail();
    return result.data as ({ id: string; status: "PENDING" | "USED" | "REVOKED" | "EXPIRED"; expires_at: string; admin: AdminRecord } | null);
  }
  async cancelPendingInvitation(adminId: string, now: Date) {
    const result = await supabaseAdmin.from("admin_invitations").update({ status: "REVOKED", revoked_at: now.toISOString() }).eq("admin_id", adminId).eq("status", "PENDING");
    if (result.error) throw fail();
  }
  async replaceOtp(input: { adminId: string; purpose: "ADMIN_ACTIVATION" | "ADMIN_LOGIN"; codeHash: string; expiresAt: Date; resendAvailableAt: Date; maxAttempts: number; now: Date }) {
    const result = await supabaseAdmin.rpc("replace_admin_otp", { p_admin_id: input.adminId, p_purpose: input.purpose, p_code_hash: input.codeHash, p_expires_at: input.expiresAt.toISOString(), p_resend_available_at: input.resendAvailableAt.toISOString(), p_max_attempts: input.maxAttempts, p_now: input.now.toISOString() }).single();
    if (result.error || !result.data) throw fail();
    return row(result.data);
  }
  async invalidateOtp(challengeId: string, now: Date) {
    const result = await supabaseAdmin.from("otp_challenges").update({ invalidated_at: now.toISOString() }).eq("id", challengeId).is("consumed_at", null);
    if (result.error) throw fail();
  }
  async getChallenge(challengeId: string) {
    const result = await supabaseAdmin.from("otp_challenges").select("id, admin_id, purpose, consumed_at, invalidated_at").eq("id", challengeId).maybeSingle();
    if (result.error) throw fail();
    return result.data as { id: string; admin_id: string | null; purpose: "ADMIN_ACTIVATION" | "ADMIN_LOGIN"; consumed_at: string | null; invalidated_at: string | null } | null;
  }
  async hasLivePendingInvitation(adminId: string, now: Date) {
    const result = await supabaseAdmin.from("admin_invitations").select("id").eq("admin_id", adminId).eq("status", "PENDING").gt("expires_at", now.toISOString()).maybeSingle();
    if (result.error) throw fail();
    return Boolean(result.data);
  }
  async verifyOtp(input: { challengeId: string; purpose: "ADMIN_ACTIVATION" | "ADMIN_LOGIN"; codeHash: string; proofHash: string; proofExpiresAt: Date; now: Date }) {
    const result = await supabaseAdmin.rpc("verify_admin_otp", { p_challenge_id: input.challengeId, p_purpose: input.purpose, p_code_hash: input.codeHash, p_proof_hash: input.proofHash, p_proof_expires_at: input.proofExpiresAt.toISOString(), p_now: input.now.toISOString() }).single();
    if (result.error || !result.data) throw fail();
    return row(result.data);
  }
  async completeActivation(proofHash: string, passwordHash: string, now: Date) {
    const result = await supabaseAdmin.rpc("complete_admin_activation", { p_proof_hash: proofHash, p_password_hash: passwordHash, p_now: now.toISOString() }).single();
    if (result.error || !result.data) throw fail();
    return row(result.data);
  }
  async completeFirstPasswordChange(proofHash: string, passwordHash: string, now: Date) {
    const result = await supabaseAdmin.rpc("complete_first_admin_password_change", { p_proof_hash: proofHash, p_password_hash: passwordHash, p_now: now.toISOString() }).single();
    if (result.error || !result.data) throw fail();
    return row(result.data);
  }
  async findAdminForPasswordChangeProof(proofHash: string) {
    const result = await supabaseAdmin.from("otp_challenges").select("admin:admins(*)").eq("purpose", "ADMIN_LOGIN").eq("verified_proof_hash", proofHash).maybeSingle();
    if (result.error) throw fail();
    return (result.data as { admin: AdminRecord | null } | null)?.admin ?? null;
  }
  async createSession(input: { adminId: string; sessionId: string; refreshTokenHash: string; expiresAt: Date; now: Date }) {
    const result = await supabaseAdmin.rpc("create_admin_session", { p_admin_id: input.adminId, p_session_id: input.sessionId, p_refresh_token_hash: input.refreshTokenHash, p_expires_at: input.expiresAt.toISOString(), p_now: input.now.toISOString() }).single();
    if (result.error || !result.data) throw fail();
    return row(result.data);
  }
  async rotateSession(input: { adminId: string; sessionId: string; refreshTokenHash: string; replacementSessionId: string; replacementRefreshTokenHash: string; replacementExpiresAt: Date; now: Date }) {
    const result = await supabaseAdmin.rpc("rotate_admin_session", { p_admin_id: input.adminId, p_session_id: input.sessionId, p_refresh_token_hash: input.refreshTokenHash, p_replacement_session_id: input.replacementSessionId, p_replacement_refresh_token_hash: input.replacementRefreshTokenHash, p_replacement_expires_at: input.replacementExpiresAt.toISOString(), p_now: input.now.toISOString() }).single();
    if (result.error || !result.data) throw fail();
    return row(result.data);
  }
  async revokeSession(input: { adminId: string; sessionId: string; refreshTokenHash: string; now: Date }) {
    const result = await supabaseAdmin.rpc("revoke_admin_session", { p_admin_id: input.adminId, p_session_id: input.sessionId, p_refresh_token_hash: input.refreshTokenHash, p_now: input.now.toISOString() }).single();
    if (result.error || !result.data) throw fail();
    return row(result.data);
  }
  async changePassword(adminId: string, passwordHash: string, now: Date) {
    const result = await supabaseAdmin.rpc("change_admin_password", { p_admin_id: adminId, p_password_hash: passwordHash, p_now: now.toISOString() }).single();
    if (result.error || !result.data) throw fail();
    return row(result.data);
  }
  async changeStatus(adminId: string, status: "ACTIVE" | "SUSPENDED" | "LOCKED", now: Date) {
    const result = await supabaseAdmin.rpc("update_admin_status", { p_admin_id: adminId, p_status: status, p_now: now.toISOString() }).single();
    if (result.error || !result.data) throw fail();
    return row(result.data);
  }
  async getSession(adminId: string, sessionId: string) {
    const result = await supabaseAdmin.from("admin_sessions").select("id, admin_id, session_version, expires_at, revoked_at, replaced_by_session_id").eq("id", sessionId).eq("admin_id", adminId).maybeSingle();
    if (result.error) throw fail();
    return result.data;
  }
  async listStaff() {
    const result = await supabaseAdmin.from("admins").select("id, full_name, email, phone, department, admin_role, status, requires_password_change, last_login_at, created_at, updated_at").order("created_at", { ascending: false });
    if (result.error) throw fail();
    return result.data ?? [];
  }
}
