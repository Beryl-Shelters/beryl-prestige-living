import { describe, expect, it, vi } from "vitest";
import {
  createReferralOtpDelivery,
  referralOtpMessage,
  TermiiDeliveryError
} from "./referral.provider";

const configuration = {
  provider: "termii",
  apiKey: "termii-secret-key",
  baseUrl: "https://account.example.termii.com",
  senderId: "Beryl Device",
  channel: "whatsapp"
};

const acceptedResponse = () => new Response(JSON.stringify({
  code: "ok",
  message: "Successfully Sent",
  message_id: "3017544054459083819856413"
}), { status: 200, headers: { "Content-Type": "application/json" } });

const input = { phone: "+2348012345678", code: "381042", expiresInMinutes: 10 };

describe("Termii referral OTP delivery", () => {
  it("keeps the provider disabled when selection or required configuration is absent", () => {
    expect(createReferralOtpDelivery({}).available).toBe(false);
    const incomplete = createReferralOtpDelivery({ provider: "termii", apiKey: "secret" });
    expect(incomplete).toMatchObject({ available: false, configurationStatus: "incomplete" });
  });

  it("rejects unsafe base URLs, unsupported channels, and unsafe sender values", () => {
    expect(createReferralOtpDelivery({ ...configuration, baseUrl: "http://termii.example" }).configurationStatus).toBe("invalid");
    expect(createReferralOtpDelivery({ ...configuration, baseUrl: "https://termii.example?next=bad" }).configurationStatus).toBe("invalid");
    expect(createReferralOtpDelivery({ ...configuration, channel: "sms" }).configurationStatus).toBe("invalid");
    expect(createReferralOtpDelivery({ ...configuration, senderId: "bad\nvalue" }).configurationStatus).toBe("invalid");
  });

  it("selects Termii only with complete valid WhatsApp configuration", () => {
    expect(createReferralOtpDelivery(configuration)).toMatchObject({
      available: true,
      provider: "termii",
      configurationStatus: "configured"
    });
  });

  it("sends the documented normalized phone, channel, sender, and Beryl-owned OTP payload", async () => {
    const request = vi.fn(async (_url: string | URL | Request, _options?: RequestInit) => acceptedResponse());
    const delivery = createReferralOtpDelivery(configuration, request as typeof fetch);
    await delivery.send(input);

    expect(request).toHaveBeenCalledOnce();
    const [url, options] = request.mock.calls[0];
    expect(url).toBe("https://account.example.termii.com/api/sms/send");
    expect(options?.method).toBe("POST");
    expect(JSON.parse(String(options?.body))).toEqual({
      api_key: configuration.apiKey,
      to: "2348012345678",
      from: configuration.senderId,
      sms: referralOtpMessage(input.code, input.expiresInMinutes),
      type: "plain",
      channel: "whatsapp"
    });
  });

  it("does not log the OTP, API key, or provider request payload", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const delivery = createReferralOtpDelivery(configuration, vi.fn(async () => acceptedResponse()) as typeof fetch);
    await delivery.send(input);
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    log.mockRestore();
    error.mockRestore();
  });

  it("rejects invalid recipient or code before invoking Termii", async () => {
    const request = vi.fn(async () => acceptedResponse());
    const delivery = createReferralOtpDelivery(configuration, request as typeof fetch);
    await expect(delivery.send({ ...input, phone: "08012345678" })).rejects.toMatchObject({ reason: "INVALID_INPUT" });
    await expect(delivery.send({ ...input, code: "12345" })).rejects.toMatchObject({ reason: "INVALID_INPUT" });
    expect(request).not.toHaveBeenCalled();
  });

  it("distinguishes a bounded timeout", async () => {
    const request = vi.fn((_url: string | URL | Request, options?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => {
        const abort = new Error("aborted");
        abort.name = "AbortError";
        reject(abort);
      });
    }));
    const delivery = createReferralOtpDelivery({ ...configuration, timeoutMs: 1 }, request as typeof fetch);
    await expect(delivery.send(input)).rejects.toMatchObject({ reason: "TIMEOUT" });
  });

  it("maps network failures without exposing their raw message", async () => {
    const delivery = createReferralOtpDelivery(configuration, vi.fn(async () => {
      throw new Error("socket failed for secret account");
    }) as typeof fetch);
    const failure = await delivery.send(input).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(TermiiDeliveryError);
    expect(failure).toMatchObject({ reason: "NETWORK_FAILURE", message: "Termii referral OTP delivery failed" });
    expect(String(failure)).not.toContain("secret account");
  });

  it("rejects non-2xx HTTP responses", async () => {
    const delivery = createReferralOtpDelivery(configuration, vi.fn(async () => new Response("denied", { status: 401 })) as typeof fetch);
    await expect(delivery.send(input)).rejects.toMatchObject({ reason: "HTTP_REJECTION" });
  });

  it("rejects Termii application-level failures even on HTTP 200", async () => {
    const delivery = createReferralOtpDelivery(configuration, vi.fn(async () => new Response(JSON.stringify({
      code: "failed",
      message: "Insufficient balance"
    }), { status: 200 })) as typeof fetch);
    await expect(delivery.send(input)).rejects.toMatchObject({ reason: "PROVIDER_REJECTION" });
  });

  it("accepts the documented success contract", async () => {
    const delivery = createReferralOtpDelivery(configuration, vi.fn(async () => acceptedResponse()) as typeof fetch);
    await expect(delivery.send(input)).resolves.toBeUndefined();
  });

  it("rejects malformed JSON and success responses without a message ID", async () => {
    const invalidJson = createReferralOtpDelivery(configuration, vi.fn(async () => new Response("not-json", { status: 200 })) as typeof fetch);
    await expect(invalidJson.send(input)).rejects.toMatchObject({ reason: "MALFORMED_RESPONSE" });

    const missingId = createReferralOtpDelivery(configuration, vi.fn(async () => new Response(JSON.stringify({ code: "ok" }), { status: 200 })) as typeof fetch);
    await expect(missingId.send(input)).rejects.toMatchObject({ reason: "MALFORMED_RESPONSE" });
  });
});
