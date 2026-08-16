import { randomUUID } from "node:crypto";
import { AppError } from "../../utils/AppError";
import { AdminMailService } from "../../services/mail.service";
import { AdminDepartment, AdminRole } from "../auth-onboarding/auth-onboarding.types";
import { generateSixDigitOtp, hashOtp } from "../auth-onboarding/otp";
import { createTemporaryAdminPassword, hashAdminPassword, verifyAdminPassword } from "./admin-password";
import { AdminTokenError, createAdminProof, hashAdminInvitationToken, hashAdminSecret, issueAdminAccessToken, issueAdminRefreshToken, verifyAdminRefreshToken } from "./admin-session.tokens";
import { AdminRecord, SupabaseAdminAuthStore } from "./supabase-admin-auth.store";
import { AdminServerAnalytics, noOpAdminServerAnalytics } from "../../analytics/admin-server-analytics";

type Options = { otpSecret: string; invitationTokenSecret: string; invitationExpiresIn: number; activationOtpExpiryMinutes: number; activationOtpMaxAttempts: number; activationOtpResendCooldownSeconds: number; adminAccessTokenSecret: string; adminAccessTokenExpiresIn: number; adminRefreshTokenSecret: string; adminRefreshTokenExpiresIn: number; customerAccessTokenSecret: string; customerRefreshTokenSecret: string; adminLoginOtpExpiryMinutes: number; adminLoginOtpMaxAttempts: number; adminLoginOtpResendCooldownSeconds: number; adminPasswordChangeProofExpiresIn: number; adminActivationUrl: string; now?: () => Date; generateOtp?: () => string };
const maskEmail = (email: string) => { const [name, domain] = email.split("@"); return `${name.slice(0, 1)}***${name.slice(-1)}@${domain}`; };

export class AdminAuthService {
  private readonly now: () => Date;
  private readonly generateOtp: () => string;
  constructor(private readonly store: SupabaseAdminAuthStore, private readonly mail: AdminMailService, private readonly options: Options, private readonly analytics: AdminServerAnalytics = noOpAdminServerAnalytics) { this.now = options.now ?? (() => new Date()); this.generateOtp = options.generateOtp ?? generateSixDigitOtp; }
  private requireConfiguration() {
    if (this.options.otpSecret.length < 32 || this.options.invitationTokenSecret.length < 32 || this.options.invitationExpiresIn <= 0 || this.options.activationOtpExpiryMinutes <= 0) throw new AppError("Admin activation is temporarily unavailable", 503, "ADMIN_ACTIVATION_UNAVAILABLE");
  }
  private requireSessionConfiguration() {
    const { adminAccessTokenSecret: access, adminRefreshTokenSecret: refresh, customerAccessTokenSecret: customerAccess, customerRefreshTokenSecret: customerRefresh } = this.options;
    if (access.length < 32 || refresh.length < 32 || access === refresh || refresh === customerAccess || refresh === customerRefresh || this.options.adminAccessTokenExpiresIn <= 0 || this.options.adminRefreshTokenExpiresIn <= 0) throw new AppError("Admin session authentication is temporarily unavailable", 503, "ADMIN_SESSION_REFRESH_UNAVAILABLE");
  }
  private refreshError(status: string): AppError {
    if (status === "REFRESH_TOKEN_EXPIRED") return new AppError("Admin refresh token has expired", 401, "ADMIN_REFRESH_TOKEN_EXPIRED");
    if (status === "REFRESH_TOKEN_REVOKED") return new AppError("Admin refresh token has been revoked", 401, "ADMIN_REFRESH_TOKEN_REVOKED");
    if (status === "REFRESH_TOKEN_REUSED") return new AppError("Admin refresh token reuse detected; sessions have been revoked", 401, "ADMIN_REFRESH_TOKEN_REUSED");
    if (status === "SESSION_NOT_FOUND") return new AppError("Admin session was not found", 401, "ADMIN_SESSION_NOT_FOUND");
    if (status === "ACCOUNT_SUSPENDED") return new AppError("Admin account is suspended", 403, "ADMIN_ACCOUNT_SUSPENDED");
    if (status === "ACCOUNT_LOCKED") return new AppError("Admin account is locked", 423, "ADMIN_ACCOUNT_LOCKED");
    if (status === "PASSWORD_CHANGE_REQUIRED") return new AppError("Admin password change is required", 403, "ADMIN_PASSWORD_CHANGE_REQUIRED");
    return new AppError("Invalid Admin refresh token", 401, "INVALID_ADMIN_REFRESH_TOKEN");
  }
  private passwordChangeError(status: string): AppError {
    if (status === "ACCOUNT_SUSPENDED") return new AppError("Admin account is suspended", 403, "ADMIN_ACCOUNT_SUSPENDED");
    if (status === "ACCOUNT_LOCKED") return new AppError("Admin account is locked", 423, "ADMIN_ACCOUNT_LOCKED");
    return new AppError("Admin password change is unavailable", 503, "ADMIN_PASSWORD_CHANGE_UNAVAILABLE");
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
    this.analytics.otpSent(admin, "admin_activation");
    return { challengeId: String(result.result_challenge_id), maskedEmail: maskEmail(admin.email), otpLength: 6 as const, resendAvailableIn: this.options.activationOtpResendCooldownSeconds, nextAction: "VERIFY_ADMIN_ACTIVATION_OTP" as const };
  }
  async invite(actorId: string, input: { fullName: string; email: string; phone?: string; department: AdminDepartment; adminRole: AdminRole }) {
    this.requireConfiguration(); const now = this.now(); const token = createAdminProof(); const temporaryPassword = createTemporaryAdminPassword(); const expiresAt = new Date(now.getTime() + this.options.invitationExpiresIn * 1_000);
    const result = await this.store.createInvitation({ adminId: randomUUID(), invitedByAdminId: actorId, fullName: input.fullName, email: input.email, phone: input.phone ?? null, department: input.department, role: input.adminRole, passwordHash: hashAdminPassword(temporaryPassword), tokenHash: hashAdminInvitationToken(this.options.invitationTokenSecret, token), expiresAt, now });
    if (result.result_status === "EMAIL_EXISTS") { this.analytics.invitationBlockedDuplicate(actorId); throw new AppError("An Admin with this email already exists", 409, "ADMIN_EMAIL_ALREADY_EXISTS"); }
    if (result.result_status === "PHONE_EXISTS") throw new AppError("An Admin with this phone already exists", 409, "ADMIN_PHONE_ALREADY_EXISTS");
    if (result.result_status !== "OK" || !result.result_admin_id) throw new AppError("Unable to create Admin invitation", 503, "ADMIN_INVITATION_FAILED");
    const activationUrl = `${this.options.adminActivationUrl.replace(/\/$/, "")}?token=${encodeURIComponent(token)}`;
    try { await this.mail.sendAdminInvitation({ to: input.email, fullName: input.fullName, activationUrl, temporaryPassword, expiresInHours: Math.ceil(this.options.invitationExpiresIn / 3600), role: input.adminRole, department: input.department }); }
    catch { await this.store.cancelPendingInvitation(String(result.result_admin_id), now).catch(() => undefined); throw new AppError("Unable to deliver Admin invitation", 503, "MAIL_DELIVERY_FAILED"); }
    this.analytics.adminInvited(actorId, input.department, input.adminRole);
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
    this.analytics.invitationResent(actorId);
    return { adminId, email: maskEmail(admin.email), status: "PENDING" as const, invitationExpiresIn: this.options.invitationExpiresIn };
  }
  async listStaff() {
    const staff = await this.store.listStaff();
    return staff.map((member) => {
      const row = member as { id: string; full_name: string; email: string; phone: string | null; department: AdminDepartment; admin_role: AdminRole; status: string; requires_password_change: boolean; created_at: string; updated_at: string };
      return { id: row.id, fullName: row.full_name, email: row.email, phone: row.phone, department: row.department, adminRole: row.admin_role, status: row.status, requiresPasswordChange: row.requires_password_change, createdAt: row.created_at, updatedAt: row.updated_at };
    });
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
    this.analytics.otpVerificationSucceeded(admin, "admin_activation");
    return { setupToken, expiresIn: this.options.activationOtpExpiryMinutes * 60, nextAction: "SET_ADMIN_PASSWORD" as const };
  }
  async setPassword(input: { setupToken: string; newPassword: string }) {
    const result = await this.store.completeActivation(hashAdminSecret(input.setupToken), hashAdminPassword(input.newPassword), this.now());
    if (result.result_status === "USED_PROOF") throw new AppError("Setup token has already been used", 409, "ADMIN_SETUP_TOKEN_USED");
    if (result.result_status === "EXPIRED_PROOF") throw new AppError("Setup token has expired", 401, "ADMIN_SETUP_TOKEN_EXPIRED");
    if (result.result_status !== "OK") throw new AppError("Setup token is invalid", 401, "INVALID_ADMIN_SETUP_TOKEN");
    const adminId = String(result.result_admin_id ?? ""); const admin = adminId ? await this.store.findAdminById(adminId).catch(() => null) : null; if (admin) this.analytics.accountActivated(admin);
    return { status: "ACTIVE" as const, nextAction: "ADMIN_LOGIN" as const };
  }
  private async startLoginOtp(admin: AdminRecord) { const now=this.now(); const otp=this.generateOtp(); const result=await this.store.replaceOtp({adminId:admin.id,purpose:"ADMIN_LOGIN",codeHash:hashOtp(this.options.otpSecret,admin.email,"ADMIN_LOGIN",otp),expiresAt:new Date(now.getTime()+this.options.adminLoginOtpExpiryMinutes*60000),resendAvailableAt:new Date(now.getTime()+this.options.adminLoginOtpResendCooldownSeconds*1000),maxAttempts:Math.min(Math.max(this.options.adminLoginOtpMaxAttempts,1),3),now}); if(result.result_status==="COOLDOWN") throw new AppError("Please wait before requesting another code",429,"OTP_RESEND_COOLDOWN"); if(result.result_status!=="OK") throw new AppError("Admin login is temporarily unavailable",503,"ADMIN_LOGIN_UNAVAILABLE"); try { await this.mail.sendAdminOtp({to:admin.email,fullName:admin.full_name,otp,purpose:"login",expiresInMinutes:this.options.adminLoginOtpExpiryMinutes}); } catch { await this.store.invalidateOtp(String(result.result_challenge_id),now).catch(()=>undefined); throw new AppError("Unable to deliver Admin login email",503,"MAIL_DELIVERY_FAILED"); } this.analytics.otpSent(admin,"login"); return {challengeId:String(result.result_challenge_id),maskedEmail:maskEmail(admin.email),otpLength:6 as const,resendAvailableIn:this.options.adminLoginOtpResendCooldownSeconds,requiresPasswordChange:admin.requires_password_change,nextAction:"VERIFY_ADMIN_LOGIN_OTP" as const}; }
  async login(input:{email:string;password:string}, anonymousAnalyticsId?: string) { const admin=await this.store.findAdminByEmail(input.email); if(!admin||!verifyAdminPassword(input.password,admin.password_hash)) { this.analytics.loginFailed(anonymousAnalyticsId); throw new AppError("Incorrect email or password",401,"INVALID_ADMIN_CREDENTIALS"); } if(admin.status==="PENDING") throw new AppError("Admin account activation is pending",403,"ADMIN_ACCOUNT_PENDING"); if(admin.status==="SUSPENDED") throw new AppError("Admin account is suspended",403,"ADMIN_ACCOUNT_SUSPENDED"); if(admin.status==="LOCKED") throw new AppError("Admin account is locked",423,"ADMIN_ACCOUNT_LOCKED"); const challenge = await this.startLoginOtp(admin); this.analytics.loginSuccee(anonymousAnalyticsId, admin); return challenge; }
  async resendLoginOtp(challengeId:string) { const challenge=await this.store.getChallenge(challengeId); const admin=challenge?.admin_id?await this.store.findAdminById(challenge.admin_id):null; if(!challenge||challenge.purpose!=="ADMIN_LOGIN"||!admin||admin.status!=="ACTIVE") throw new AppError("Login challenge is invalid",400,"ADMIN_LOGIN_CHALLENGE_INVALID"); const data=await this.startLoginOtp(admin); return {resendAvailableIn:data.resendAvailableIn}; }
  async verifyLoginOtp(input:{challengeId:string;otp:string}) { const now=this.now(); const challenge=await this.store.getChallenge(input.challengeId); const admin=challenge?.admin_id?await this.store.findAdminById(challenge.admin_id):null; if(!admin) throw new AppError("Invalid verification code",400,"INVALID_OTP"); const proof=createAdminProof(); const result=await this.store.verifyOtp({challengeId:input.challengeId,purpose:"ADMIN_LOGIN",codeHash:hashOtp(this.options.otpSecret,admin.email,"ADMIN_LOGIN",input.otp),proofHash:hashAdminSecret(proof),proofExpiresAt:new Date(now.getTime()+this.options.adminPasswordChangeProofExpiresIn*1000),now}); if(result.result_status!=="VERIFIED") this.mapOtp(String(result.result_status),Number(result.result_attempts_remaining)); this.analytics.otpVerificationSucceeded(admin,"login"); if(admin.requires_password_change) return {requiresPasswordChange:true,changePasswordToken:proof,expiresIn:this.options.adminPasswordChangeProofExpiresIn,nextAction:"CHANGE_INITIAL_ADMIN_PASSWORD" as const}; const sessionId=randomUUID(); const refreshToken=issueAdminRefreshToken({secret:this.options.adminRefreshTokenSecret,adminId:admin.id,sessionId,sessionVersion:admin.session_version,role:admin.admin_role,department:admin.department,restricted:false,expiresIn:this.options.adminRefreshTokenExpiresIn,now}); const session=await this.store.createSession({adminId:admin.id,sessionId,refreshTokenHash:hashAdminSecret(refreshToken),expiresAt:new Date(now.getTime()+this.options.adminRefreshTokenExpiresIn*1000),now}); if(session.result_status!=="OK") throw new AppError("Admin login is temporarily unavailable",503,"ADMIN_LOGIN_UNAVAILABLE"); this.analytics.adminLoggedIn(admin); const version=Number(session.result_session_version??admin.session_version); return {admin:{id:admin.id,fullName:admin.full_name,email:admin.email,department:admin.department,adminRole:admin.admin_role,status:admin.status,requiresPasswordChange:false},accessToken:issueAdminAccessToken({secret:this.options.adminAccessTokenSecret,adminId:admin.id,sessionId,sessionVersion:version,role:admin.admin_role,department:admin.department,restricted:false,expiresIn:this.options.adminAccessTokenExpiresIn,now}),refreshToken,accessTokenExpiresIn:this.options.adminAccessTokenExpiresIn,refreshTokenExpiresIn:this.options.adminRefreshTokenExpiresIn,nextAction:"OPEN_ADMIN_DASHBOARD" as const}; }
  async completeFirstPasswordChange(input:{changePasswordToken:string;currentPassword:string;newPassword:string}) { const proofHash=hashAdminSecret(input.changePasswordToken); const admin=await this.store.findAdminForPasswordChangeProof(proofHash); if(!admin) throw new AppError("Invalid password-change token",401,"INVALID_ADMIN_PASSWORD_CHANGE_TOKEN"); if(!verifyAdminPassword(input.currentPassword,admin.password_hash)) throw new AppError("Current password is incorrect",401,"CURRENT_PASSWORD_INCORRECT"); if(input.currentPassword===input.newPassword) throw new AppError("New password must differ from current password",400,"NEW_PASSWORD_SAME_AS_CURRENT"); const result=await this.store.completeFirstPasswordChange(proofHash,hashAdminPassword(input.newPassword),this.now()); if(result.result_status==="INVALID_TOKEN") throw new AppError("Invalid password-change token",401,"INVALID_ADMIN_PASSWORD_CHANGE_TOKEN"); if(result.result_status==="EXPIRED_TOKEN") throw new AppError("Password-change token has expired",401,"ADMIN_PASSWORD_CHANGE_TOKEN_EXPIRED"); if(result.result_status==="USED_TOKEN") throw new AppError("Password-change token has already been used",409,"ADMIN_PASSWORD_CHANGE_TOKEN_USED"); if(result.result_status!=="OK") throw new AppError("Password change is unavailable",503,"ADMIN_PASSWORD_CHANGE_UNAVAILABLE"); return {requiresPasswordChange:false,sessionsInvalidated:true,nextAction:"ADMIN_LOGIN" as const}; }
  async refresh(refreshToken: string) {
    this.requireSessionConfiguration();
    let claims;
    try { claims = verifyAdminRefreshToken(refreshToken, this.options.adminRefreshTokenSecret, this.now()); }
    catch (error) { throw error instanceof AdminTokenError && error.reason === "EXPIRED" ? this.refreshError("REFRESH_TOKEN_EXPIRED") : this.refreshError("INVALID_REFRESH_TOKEN"); }
    if (claims.restricted) throw this.refreshError("INVALID_REFRESH_TOKEN");
    const now = this.now(); const replacementSessionId = randomUUID();
    const replacementRefreshToken = issueAdminRefreshToken({ secret: this.options.adminRefreshTokenSecret, adminId: claims.sub, sessionId: replacementSessionId, sessionVersion: claims.ver, role: claims.role, department: claims.department, restricted: false, expiresIn: this.options.adminRefreshTokenExpiresIn, now });
    let result: Record<string, unknown>;
    try { result = await this.store.rotateSession({ adminId: claims.sub, sessionId: claims.sid, refreshTokenHash: hashAdminSecret(refreshToken), replacementSessionId, replacementRefreshTokenHash: hashAdminSecret(replacementRefreshToken), replacementExpiresAt: new Date(now.getTime() + this.options.adminRefreshTokenExpiresIn * 1_000), now }); }
    catch { throw new AppError("Admin session refresh is temporarily unavailable", 503, "ADMIN_SESSION_REFRESH_UNAVAILABLE"); }
    if (result.result_status !== "OK" || !Number.isInteger(Number(result.result_session_version))) throw this.refreshError(String(result.result_status));
    const sessionVersion = Number(result.result_session_version);
    return { accessToken: issueAdminAccessToken({ secret: this.options.adminAccessTokenSecret, adminId: claims.sub, sessionId: replacementSessionId, sessionVersion, role: claims.role, department: claims.department, restricted: false, expiresIn: this.options.adminAccessTokenExpiresIn, now }), refreshToken: replacementRefreshToken, accessTokenExpiresIn: this.options.adminAccessTokenExpiresIn, refreshTokenExpiresIn: this.options.adminRefreshTokenExpiresIn };
  }
  async logout(session: { adminId: string; sessionId: string }, refreshToken: string) {
    this.requireSessionConfiguration();
    let claims;
    try { claims = verifyAdminRefreshToken(refreshToken, this.options.adminRefreshTokenSecret, this.now()); }
    catch { throw this.refreshError("INVALID_REFRESH_TOKEN"); }
    if (claims.restricted || claims.sub !== session.adminId || claims.sid !== session.sessionId) throw this.refreshError("INVALID_REFRESH_TOKEN");
    let result: Record<string, unknown>;
    try { result = await this.store.revokeSession({ adminId: session.adminId, sessionId: session.sessionId, refreshTokenHash: hashAdminSecret(refreshToken), now: this.now() }); }
    catch { throw new AppError("Admin logout is temporarily unavailable", 503, "ADMIN_LOGOUT_UNAVAILABLE"); }
    if (result.result_status !== "OK") throw this.refreshError(String(result.result_status));
    return { revoked: true as const };
  }
  async changePassword(adminId: string, currentPassword: string, newPassword: string) {
    this.requireSessionConfiguration();
    let admin: AdminRecord | null;
    try { admin = await this.store.findAdminById(adminId); }
    catch { throw new AppError("Admin password change is unavailable", 503, "ADMIN_PASSWORD_CHANGE_UNAVAILABLE"); }
    if (!admin) throw this.passwordChangeError("ACCOUNT_NOT_FOUND");
    if (admin.status === "SUSPENDED") throw this.passwordChangeError("ACCOUNT_SUSPENDED");
    if (admin.status === "LOCKED") throw this.passwordChangeError("ACCOUNT_LOCKED");
    if (!verifyAdminPassword(currentPassword, admin.password_hash)) throw new AppError("Current password is incorrect", 401, "CURRENT_PASSWORD_INCORRECT");
    if (currentPassword === newPassword) throw new AppError("New password must differ from current password", 400, "NEW_PASSWORD_SAME_AS_CURRENT");
    let result: Record<string, unknown>;
    try { result = await this.store.changePassword(adminId, hashAdminPassword(newPassword), this.now()); }
    catch { throw new AppError("Admin password change is unavailable", 503, "ADMIN_PASSWORD_CHANGE_UNAVAILABLE"); }
    if (result.result_status !== "OK") throw this.passwordChangeError(String(result.result_status));
    return { sessionsInvalidated: true as const, nextAction: "ADMIN_LOGIN" as const };
  }
}
