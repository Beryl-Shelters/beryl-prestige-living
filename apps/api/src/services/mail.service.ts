import { Resend } from "resend";
import { env } from "../config/env";

export type RegistrationOtpMail = {
  to: string;
  fullName: string;
  otp: string;
  expiresInMinutes: number;
};

export interface MailService {
  sendRegistrationOtp(message: RegistrationOtpMail): Promise<void>;
  sendPasswordResetOtp(message: RegistrationOtpMail): Promise<void>;
}

export interface AdminMailService {
  sendAdminInvitation(message: AdminInvitationMail): Promise<void>;
  sendAdminOtp(message: AdminOtpMail): Promise<void>;
}

export type AdminInvitationMail = {
  to: string;
  fullName: string;
  activationUrl: string;
  temporaryPassword: string;
  expiresInHours: number;
  role: "ADMIN" | "SUPER_ADMIN";
  department: "TECH" | "MANAGEMENT";
};

export type AdminOtpMail = {
  to: string;
  fullName: string;
  otp: string;
  purpose: "activation" | "login";
  expiresInMinutes: number;
};

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[character] ?? character
  );

export class ResendMailService implements MailService, AdminMailService {
  private readonly resend: Resend;

  constructor(
    apiKey: string,
    private readonly fromEmail: string,
    private readonly fromName: string
  ) {
    if (/@(?:gmail|googlemail)\.com$/i.test(fromEmail)) {
      throw new Error("RESEND_FROM_EMAIL must not use a Gmail sender address");
    }
    this.resend = new Resend(apiKey);
  }

  async sendRegistrationOtp(message: RegistrationOtpMail) {
    const fullName = escapeHtml(message.fullName);
    const subject = "Verify your Beryl Shelter account";
    const text = [
      `Hello ${message.fullName},`,
      "",
      "Welcome to Beryl Shelter Nigeria Limited.",
      `Your verification code is ${message.otp}.`,
      `This code expires in ${message.expiresInMinutes} minutes.`,
      "Do not share this code with anyone.",
      "",
      "Beryl Shelter Nigeria Limited"
    ].join("\n");
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
        <h1 style="font-size:22px">Beryl Shelter</h1>
        <p>Hello ${fullName},</p>
        <p>Welcome to Beryl Shelter Nigeria Limited. Use this verification code to finish creating your account:</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:8px">${message.otp}</p>
        <p>This code expires in ${message.expiresInMinutes} minutes.</p>
        <p><strong>Do not share this code with anyone.</strong></p>
        <p>Beryl Shelter Nigeria Limited</p>
      </div>
    `;

    const { error } = await this.resend.emails.send({
      from: `${this.fromName} <${this.fromEmail}>`,
      to: message.to,
      subject,
      html,
      text
    });

    if (error) {
      throw new Error("Resend rejected the verification email");
    }
  }

  async sendPasswordResetOtp(message: RegistrationOtpMail) {
    const fullName = escapeHtml(message.fullName);
    const subject = "Reset your Beryl Shelter password";
    const text = [
      `Hello ${message.fullName},`,
      "",
      "We received a request to reset your Beryl Shelter Nigeria Limited password.",
      `Your password-reset code is ${message.otp}.`,
      `This code expires in ${message.expiresInMinutes} minutes.`,
      "Do not share this code with anyone.",
      "If you did not request this, you can ignore this email.",
      "",
      "Beryl Shelter Nigeria Limited"
    ].join("\n");
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
        <h1 style="font-size:22px">Beryl Shelter</h1>
        <p>Hello ${fullName},</p>
        <p>We received a request to reset your Beryl Shelter Nigeria Limited password.</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:8px">${message.otp}</p>
        <p>This code expires in ${message.expiresInMinutes} minutes.</p>
        <p><strong>Do not share this code with anyone.</strong></p>
        <p>If you did not request this, you can ignore this email.</p>
        <p>Beryl Shelter Nigeria Limited</p>
      </div>
    `;

    const { error } = await this.resend.emails.send({
      from: `${this.fromName} <${this.fromEmail}>`,
      to: message.to,
      subject,
      html,
      text
    });

    if (error) {
      throw new Error("Resend rejected the password-reset email");
    }
  }

  async sendAdminInvitation(message: AdminInvitationMail) {
    const fullName = escapeHtml(message.fullName);
    const activationUrl = escapeHtml(message.activationUrl);
    const subject = "You have been invited to Beryl Shelter Admin";
    const text = [
      `Hello ${message.fullName},`,
      "",
      `You have been invited to the Beryl Shelter Nigeria Limited Admin Portal as ${message.role} in ${message.department}.`,
      `Activate your account within ${message.expiresInHours} hours: ${message.activationUrl}`,
      `Your temporary password is: ${message.temporaryPassword}`,
      "You will verify a one-time code and choose your permanent password during activation.",
      "Do not share this email or temporary password.",
      "",
      "Beryl Shelter Nigeria Limited"
    ].join("\n");
    const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937"><h1 style="font-size:22px">Beryl Shelter</h1><p>Hello ${fullName},</p><p>You have been invited to the Beryl Shelter Nigeria Limited Admin Portal as <strong>${message.role}</strong> in <strong>${message.department}</strong>.</p><p><a href="${activationUrl}">Activate your Admin account</a></p><p>Your temporary password is:</p><p style="font-size:20px;font-weight:700;letter-spacing:1px">${escapeHtml(message.temporaryPassword)}</p><p>This invitation expires in ${message.expiresInHours} hours. You will verify a one-time code and choose a permanent password during activation.</p><p><strong>Do not forward this email or share the temporary password.</strong></p><p>Beryl Shelter Nigeria Limited</p></div>`;
    const { error } = await this.resend.emails.send({ from: `${this.fromName} <${this.fromEmail}>`, to: message.to, subject, html, text });
    if (error) throw new Error("Resend rejected the Admin invitation email");
  }

  async sendAdminOtp(message: AdminOtpMail) {
    const fullName = escapeHtml(message.fullName);
    const action = message.purpose === "activation" ? "activate your Admin account" : "sign in to the Admin Portal";
    const subject = message.purpose === "activation" ? "Activate your Beryl Shelter Admin account" : "Your Beryl Shelter Admin sign-in code";
    const text = [`Hello ${message.fullName},`, "", `Use this code to ${action}: ${message.otp}`, `This code expires in ${message.expiresInMinutes} minutes.`, "Do not share this code with anyone.", "", "Beryl Shelter Nigeria Limited"].join("\n");
    const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937"><h1 style="font-size:22px">Beryl Shelter</h1><p>Hello ${fullName},</p><p>Use this code to ${action}:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px">${message.otp}</p><p>This code expires in ${message.expiresInMinutes} minutes.</p><p><strong>Do not share this code with anyone.</strong></p><p>Beryl Shelter Nigeria Limited</p></div>`;
    const { error } = await this.resend.emails.send({ from: `${this.fromName} <${this.fromEmail}>`, to: message.to, subject, html, text });
    if (error) throw new Error("Resend rejected the Admin OTP email");
  }
}

class UnconfiguredMailService implements MailService, AdminMailService {
  async sendRegistrationOtp() {
    throw new Error("Resend email delivery is not configured");
  }

  async sendPasswordResetOtp() {
    throw new Error("Resend email delivery is not configured");
  }

  async sendAdminInvitation() {
    throw new Error("Resend email delivery is not configured");
  }

  async sendAdminOtp() {
    throw new Error("Resend email delivery is not configured");
  }
}

const resendConfigured =
  Boolean(env.resendApiKey) &&
  Boolean(env.resendFromEmail) &&
  Boolean(env.resendFromName);

export const mailService: MailService & AdminMailService = resendConfigured
  ? new ResendMailService(
      env.resendApiKey,
      env.resendFromEmail,
      env.resendFromName
    )
  : new UnconfiguredMailService();
