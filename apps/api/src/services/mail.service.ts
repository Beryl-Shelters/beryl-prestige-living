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
}

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

export class ResendMailService implements MailService {
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
    const subject = "Verify your Beryl Prestige Living account";
    const text = [
      `Hello ${message.fullName},`,
      "",
      "Welcome to Beryl Prestige Living.",
      `Your verification code is ${message.otp}.`,
      `This code expires in ${message.expiresInMinutes} minutes.`,
      "Do not share this code with anyone.",
      "",
      "Beryl Prestige Living"
    ].join("\n");
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
        <h1 style="font-size:22px">Beryl Prestige Living</h1>
        <p>Hello ${fullName},</p>
        <p>Welcome to Beryl Prestige Living. Use this verification code to finish creating your account:</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:8px">${message.otp}</p>
        <p>This code expires in ${message.expiresInMinutes} minutes.</p>
        <p><strong>Do not share this code with anyone.</strong></p>
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
}

class UnconfiguredMailService implements MailService {
  async sendRegistrationOtp() {
    throw new Error("Resend email delivery is not configured");
  }
}

const resendConfigured =
  Boolean(env.resendApiKey) &&
  Boolean(env.resendFromEmail) &&
  Boolean(env.resendFromName);

export const mailService: MailService = resendConfigured
  ? new ResendMailService(
      env.resendApiKey,
      env.resendFromEmail,
      env.resendFromName
    )
  : new UnconfiguredMailService();
