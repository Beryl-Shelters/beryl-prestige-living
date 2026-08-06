import { randomUUID } from "node:crypto";
import { AppError } from "../../utils/AppError";
import { AdminMailService } from "../../services/mail.service";
import { AdminDepartment, AdminRole } from "../auth-onboarding/auth-onboarding.types";
import { generateSixDigitOtp, hashOtp } from "../auth-onboarding/otp";
import { createTemporaryAdminPassword, hashAdminPassword, verifyAdminPassword } from "./admin-password";
import { createAdminProof, hashAdminInvitationToken, hashAdminSecret } from "./admin-session.tokens";
import { AdminRecord, SupabaseAdminAuthStore } from "./supabase-admin-auth.store";

type Options = { otpSecret: string; invitationTokenSecret: string; invitationExpiresIn: number; activationOtpExpiryMinutes: number; activationOtpMaxAttempts: number; activationOtpResendCooldownSeconds: number; adminActivationUrl: string; now?: () => Date; generateOtp?: () => string };
const maskEmail = (email: string) => { const [name, domain] = email.split("@"); return `${name.slice(0, 1)}***${name.slice(-1)}@${domain}`; };

export class AdminAuthService {
  private readonly now: () => Date;
  private readonly generateOtp: () => string;
  constructor(private readonly store: SupabaseAdminAuthStore, private readonly mail: AdminMailService, private readonly options: Options) { this.now = options.now ?? (() => new Date()); this.generateOtp = options.generateOtp ?? generateSixDigitOtp; }
  private requireConfiguration() {
    if (this.options.otpSecret.length < 32 || this.options.invitationTokenSecret.length < 32 || this.options.invitationExpiresIn <= 0 || this.options.activationOtpExpiryMinutes <= 0) throw new AppError("Admin activation is temporarily unavailable", 503, "ADMIN_ACTIVATION_UNAVAILABLE");
  }
  private otpHash(admin: AdminRecord, otp: string) { return hashOtp(this.options.otpSecret, admin.email, "ADMIN_ACTIVATION", otp); }
  private mapOtp(status: string, attempts?: number): never {
    if (status === "INVALID_OTP") throw new AppError("Invalid verification code", 400, "INVALID_OTP", { attemptsRemaining: attempts ?? 0 });
    if (status === "OTP_EXPIRED") throw new AppError("Verification code has expired", 400, "OTP_EXPIRED");
    if (status === "OTP_MAX_ATTEMPTS") throw new AppError("Maximum verification attempts exceeded", 429, "OTP_ATTEMPTS_EXCEEDED");
    throw new AppError("Verification code is no longer valid. Request a new code.", 409, "OTP_NO_LONGER_VALID");
  }
  private async startActivationOtp(admin: AdminRecord) {
    const now = this.now(); const otp = this.generateOtp();
    const result = await this.store.replaceOtp({ adminId: admin.id, purpose: "ADMIN_ACTIVATION", codeHash: this.otpHash(admin, otp), expiresAt: new Date(now.getTime() + this.options.activationOtpExpiryMinutes * 60_000), resendAvailableAt: new Date(now.getTime() + this.options.activationOtpResendCooldownSeconds * 1_000), maxAttempts: Math.min(Math.max(this.options.activationOtpMaxAttempts, 1), 3), now });
    if (result.result_status === "COOLDOWN") throw new AppError("Please wait before requesting another code", 429, "OTP_RESEND_COOLDOWN", { retryAfter: Math.max(1, Math.ceil((new Date(String(result.result_resend_available_at)).getTime() - now.getTime()) / 1000)) });
    if (result.result_status !== "OK" || !result.result_challenge_id) throw new AppError("Admin activation is temporarily unavailable", 503, "ADMIN_ACTIVATION_UNAVAILABLE");
    try { await this.mail.sendAdminOtp({ to: admin.email, fullName: admin.full_name, otp, purpose: "activation", expiresInMinutes: this.options.activationOtpExpiryMinutes }); }
    catch { await this.store.invalidateOtp(String(result.result_challenge_id), now).catch(() => undefined); throw new AppError("Unable to deliver Admin activation email", 503, "MAIL_DELIVERY_FAILED"); }
    return { challengeId: String(result.result_challenge_id), maskedEmail: maskEmail(admin.email), otpLength: 6 as const, resendAvailableIn: this.options.activationOtpResendCooldownSeconds, nextAction: "VERIFY_ADMIN_ACTIVATION_OTP" as const };
  }
  async invite(actorId: string, input: { fullName: string; email: string; phone?: string; department: AdminDepartment; adminRole: AdminRole }) {
    this.requireConfiguration(); const now = this.now(); const token = createAdminProof(); const temporaryPassword = createTemporaryAdminPassword(); const expiresAt = new Date(now.getTime() + this.options.invitationExpiresIn * 1_000);
    const result = await this.store.createInvitation({ adminId: randomUUID(), invitedByAdminId: actorId, fullName: input.fullName, email: input.email, phone: input.phone ?? null, department: input.department, role: input.adminRole, passwordHash: hashAdminPassword(temporaryPassword), tokenHash: hashAdminInvitationToken(this.options.invitationTokenSecret, token), expiresAt, now });
    if (result.result_status === "EMAIL_EXISTS") throw new AppError("An Admin with this email already exists", 409, "ADMIN_EMAIL_ALREADY_EXISTS");
    if (result.result_status === "PHONE_EXISTS") throw new AppError("An Admin with this phone already exists", 409, "ADMIN_PHONE_ALREADY_EXISTS");
    if (result.result_status !== "OK" || !result.result_admin_id) throw new AppError("Unable to create Admin invitation", 503, "ADMIN_INVITATION_FAILED");
    const activationUrl = `${this.options.adminActivationUrl.replace(/\/$/, "")}?token=${encodeURIComponent(token)}`;
    try { await this.mail.sendAdminInvitation({ to: input.email, fullName: input.fullName, activationUrl, temporaryPassword, expiresInHours: Math.ceil(this.options.invitationExpiresIn / 3600), role: input.adminRole, department: input.department }); }
    catch { await this.store.cancelPendingInvitation(String(result.result_admin_id), now).catch(() => undefined); throw new AppError("Unable to deliver Admin invitation", 503, "MAIL_DELIVERY_FAILED"); }
    return { adminId: String(result.result_admin_id), email: maskEmail(input.email), status: "PENDING" as const, invitationExpiresIn: this.options.invitationExpiresIn };
  }
  async resendInvitation(actorId: string, adminId: string) {
    this.requireConfiguration(); const admin = await this.store.findAdminById(adminId); if (!admin) throw new AppError("Admin staff member not found", 404, "ADMIN_NOT_FOUND");
    const now = this.now(); const token = createAdminProof(); const temporaryPassword = createTemporaryAdminPassword();
    const result = await this.store.replaceInvitation({ adminId, invitedByAdminId: actorId, passwordHash: hashAdminPassword(temporaryPassword), tokenHash: hashAdminInvitationToken(this.options.invitationTokenSecret, token), expiresAt: new Date(now.getTime() + this.options.invitationExpiresIn * 1_000), now });
    if (result.result_status === "COOLDOWN") throw new AppError("Please wait before resending this invitation", 429, "ADMIN_INVITATION_RESEND_COOLDOWN");
    if (result.result_status === "INVALID_STATE") throw new AppError(admin.status === "ACTIVE" ? "Admin is already active" : "Admin invitation cannot be resent", 409, admin.status === "ACTIVE" ? "ADMIN_ALREADY_ACTIVE" : "ADMIN_INVITATION_FAILED");
    if (result.result_status === "NOT_FOUND") throw new AppError("Admin staff member not found", 404, "ADMIN_NOT_FOUND");
    const activationUrl = `${this.options.adminActivationUrl.replace(/\/$/, "")}?token=${encodeURIComponent(token)}`;
    try { await this.mail.sendAdminInvitation({ to: admin.email, fullName: admin.full_name, activationUrl, temporaryPassword, expiresInHours: Math.ceil(this.options.invitationExpiresIn / 3600), role: admin.admin_role, department: admin.department }); }
    catch { await this.store.cancelPendingInvitation(adminId, now).catch(() => undefined); throw new AppError("Unable to deliver Admin invitation", 503, "MAIL_DELIVERY_FAILED"); }
    return { adminId, email: maskEmail(admin.email), status: "PENDING" as const, invitationExpiresIn: this.options.invitationExpiresIn };
  }
  async activate(input: { invitationToken: string; temporaryPassword: string }) {
    this.requireConfiguration(); const invitation = await this.store.findInvitationByTokenHash(hashAdminInvitationToken(this.options.invitationTokenSecret, input.invitationToken));
    if (!invitation) throw new AppError("Invitation token is invalid", 400, "INVALID_INVITATION_TOKEN");
    if (invitation.status === "USED") throw new AppError("Invitation has already been used", 409, "INVITATION_ALREADY_USED");
    if (invitation.status !== "PENDING") throw new AppError("Invitation token is invalid", 400, "INVALID_INVITATION_TOKEN");
    if (new Date(invitation.expires_at).getTime() <= this.now().getTime()) throw new AppError("Invitation has expired", 400, "INVITATION_EXPIRED");
    if (invitation.admin.status === "ACTIVE") throw new AppError("Admin is already active", 409, "ADMIN_ALREADY_ACTIVE");
    if (invitation.admin.status !== "PENDING" || !verifyAdminPassword(input.temporaryPassword, invitation.admin.password_hash)) throw new AppError("Admin activation is invalid", 401, "ADMIN_ACTIVATION_UNAVAILABLE");
    return this.startActivationOtp(invitation.admin);
  }
  async resendActivationOtp(challengeId: string) {
    this.requireConfiguration(); const challenge = await this.store.getChallenge(challengeId); const admin = challenge?.admin_id ? await this.store.findAdminById(challenge.admin_id) : null;
    if (!challenge || challenge.purpose !== "ADMIN_ACTIVATION" || !admin || admin.status !== "PENDING" || !(await this.store.hasLivePendingInvitation(admin.id, this.now()))) throw new AppError("Activation code is no longer valid", 409, "OTP_NO_LONGER_VALID");
    return this.startActivationOtp(admin);
  }
  async verifyActivationOtp(input: { challengeId: string; otp: string }) {
    this.requireConfiguration(); const now = this.now(); const setupToken = createAdminProof(); const challenge = await this.store.getChallenge(input.challengeId); const admin = challenge?.admin_id ? await this.store.findAdminById(challenge.admin_id) : null;
    if (!admin) throw new AppError("Invalid verification code", 400, "INVALID_OTP");
    const result = await this.store.verifyOtp({ challengeId: input.challengeId, purpose: "ADMIN_ACTIVATION", codeHash: this.otpHash(admin, input.otp), proofHash: hashAdminSecret(setupToken), proofExpiresAt: new Date(now.getTime() + this.options.activationOtpExpiryMinutes * 60_000), now });
    if (result.result_status !== "VERIFIED") this.mapOtp(String(result.result_status), Number(result.result_attempts_remaining));
    return { setupToken, expiresIn: this.options.activationOtpExpiryMinutes * 60, nextAction: "SET_ADMIN_PASSWORD" as const };
  }
  async setPassword(input: { setupToken: string; newPassword: string }) {
    const result = await this.store.completeActivation(hashAdminSecret(input.setupToken), hashAdminPassword(input.newPassword), this.now());
    if (result.result_status === "USED_PROOF") throw new AppError("Setup token has already been used", 409, "ADMIN_SETUP_TOKEN_USED");
    if (result.result_status === "EXPIRED_PROOF") throw new AppError("Setup token has expired", 401, "ADMIN_SETUP_TOKEN_EXPIRED");
    if (result.result_status !== "OK") throw new AppError("Setup token is invalid", 401, "INVALID_ADMIN_SETUP_TOKEN");
    return { status: "ACTIVE" as const, nextAction: "ADMIN_LOGIN" as const };
  }
}
