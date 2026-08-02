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

export class InMemoryDevelopmentMailService implements MailService {
  private readonly messages: RegistrationOtpMail[] = [];

  async sendRegistrationOtp(message: RegistrationOtpMail) {
    this.messages.push({ ...message });
  }

  getCapturedMessages() {
    return this.messages.map((message) => ({ ...message }));
  }
}

class HttpMailService implements MailService {
  async sendRegistrationOtp(message: RegistrationOtpMail) {
    if (!env.mailProviderApiUrl || !env.mailProviderApiKey || !env.mailFrom) {
      throw new Error("Production mail delivery is not configured");
    }

    const response = await fetch(env.mailProviderApiUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.mailProviderApiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from: env.mailFrom,
        to: message.to,
        subject: "Verify your Beryl Prestige Living account",
        text: `Hello ${message.fullName}, your verification code is ${message.otp}. It expires in ${message.expiresInMinutes} minutes.`,
        templateData: {
          otp: message.otp,
          expiresInMinutes: message.expiresInMinutes
        }
      })
    });

    if (!response.ok) {
      throw new Error("Mail provider rejected the message");
    }
  }
}

const developmentMailService = new InMemoryDevelopmentMailService();

export const mailService: MailService =
  env.nodeEnv === "production" ? new HttpMailService() : developmentMailService;

export const getDevelopmentMailService = () => developmentMailService;
