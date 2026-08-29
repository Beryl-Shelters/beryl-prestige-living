import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";

export type ReferralOtpDeliveryInput = {
  phone: string;
  code: string;
  expiresInMinutes: number;
};

export type ReferralOtpDelivery = {
  available: boolean;
  provider: "disabled" | "termii";
  configurationStatus: "disabled" | "incomplete" | "invalid" | "configured";
  send(input: ReferralOtpDeliveryInput): Promise<void>;
};

export type TermiiFailureReason =
  | "INVALID_INPUT"
  | "TIMEOUT"
  | "NETWORK_FAILURE"
  | "HTTP_REJECTION"
  | "PROVIDER_REJECTION"
  | "MALFORMED_RESPONSE";

export class TermiiDeliveryError extends Error {
  constructor(public readonly reason: TermiiFailureReason) {
    super("Termii referral OTP delivery failed");
    this.name = "TermiiDeliveryError";
  }
}

type TermiiConfiguration = {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  senderId?: string;
  channel?: string;
  timeoutMs?: number;
};

type FetchImplementation = typeof fetch;

const TERMII_SEND_PATH = "/api/sms/send";
const DEFAULT_TIMEOUT_MS = 8_000;
const INTERNATIONAL_PHONE = /^\+[1-9]\d{7,14}$/;
const SIX_DIGIT_CODE = /^\d{6}$/;

export const referralOtpMessage = (code: string, expiresInMinutes: number) =>
  `Your Beryl Shelter referral verification code is ${code}. It expires in ${expiresInMinutes} minutes.`;

const unavailableDelivery = (
  configurationStatus: "disabled" | "incomplete" | "invalid"
): ReferralOtpDelivery => ({
  available: false,
  provider: "disabled",
  configurationStatus,
  async send() {
    throw new AppError(
      "Referral tracking by phone is temporarily unavailable",
      503,
      "REFERRAL_TRACKING_UNAVAILABLE"
    );
  }
});

/** Explicit no-provider adapter retained for local and test environments. */
export const unavailableReferralOtpDelivery = unavailableDelivery("disabled");

const parseTermiiBaseUrl = (rawValue: string) => {
  try {
    const url = new URL(rawValue);
    if (
      url.protocol !== "https:" ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    ) return null;
    return url;
  } catch {
    return null;
  }
};

const isSafeSenderId = (value: string) =>
  value.length > 0 && value.length <= 100 && !/[\u0000-\u001f\u007f]/.test(value);

const isAcceptedTermiiResponse = (value: unknown) => {
  if (!value || typeof value !== "object") return false;
  const response = value as Record<string, unknown>;
  const messageId = response.message_id_str ?? response.message_id;
  return response.code === "ok" &&
    (typeof messageId === "string" || typeof messageId === "number") &&
    String(messageId).trim().length > 0;
};

export const createReferralOtpDelivery = (
  configuration: TermiiConfiguration,
  fetchImplementation: FetchImplementation = fetch
): ReferralOtpDelivery => {
  if (configuration.provider?.trim().toLowerCase() !== "termii") {
    return unavailableDelivery("disabled");
  }

  const apiKey = configuration.apiKey?.trim() || "";
  const baseUrlValue = configuration.baseUrl?.trim() || "";
  const senderId = configuration.senderId?.trim() || "";
  const channel = configuration.channel?.trim().toLowerCase() || "";
  if (!apiKey || !baseUrlValue || !senderId || !channel) {
    return unavailableDelivery("incomplete");
  }

  const baseUrl = parseTermiiBaseUrl(baseUrlValue);
  if (!baseUrl || channel !== "whatsapp" || !isSafeSenderId(senderId)) {
    return unavailableDelivery("invalid");
  }

  const configuredTimeout = configuration.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutMs = Number.isFinite(configuredTimeout)
    ? Math.min(30_000, Math.max(1_000, configuredTimeout))
    : DEFAULT_TIMEOUT_MS;
  const endpoint = new URL(TERMII_SEND_PATH, baseUrl).toString();

  return {
    available: true,
    provider: "termii",
    configurationStatus: "configured",
    async send(input) {
      if (!INTERNATIONAL_PHONE.test(input.phone) || !SIX_DIGIT_CODE.test(input.code)) {
        throw new TermiiDeliveryError("INVALID_INPUT");
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await fetchImplementation(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: apiKey,
            to: input.phone.slice(1),
            from: senderId,
            sms: referralOtpMessage(input.code, input.expiresInMinutes),
            type: "plain",
            channel
          }),
          signal: controller.signal
        });
      } catch (error) {
        if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
          throw new TermiiDeliveryError("TIMEOUT");
        }
        throw new TermiiDeliveryError("NETWORK_FAILURE");
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) throw new TermiiDeliveryError("HTTP_REJECTION");

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new TermiiDeliveryError("MALFORMED_RESPONSE");
      }
      if (!payload || typeof payload !== "object") {
        throw new TermiiDeliveryError("MALFORMED_RESPONSE");
      }
      if ((payload as Record<string, unknown>).code !== "ok") {
        throw new TermiiDeliveryError("PROVIDER_REJECTION");
      }
      if (!isAcceptedTermiiResponse(payload)) {
        throw new TermiiDeliveryError("MALFORMED_RESPONSE");
      }
    }
  };
};

export const referralOtpDelivery = createReferralOtpDelivery({
  provider: env.referralOtpProvider,
  apiKey: env.termiiApiKey,
  baseUrl: env.termiiBaseUrl,
  senderId: env.termiiSenderId,
  channel: env.termiiChannel
});
