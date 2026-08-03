import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.hoisted(() => vi.fn());

vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  }
}));

import { ResendMailService } from "./mail.service";

describe("Resend registration OTP mail", () => {
  beforeEach(() => {
    send.mockReset();
  });

  it("sends branded HTML and plain text without external images", async () => {
    send.mockResolvedValue({ data: { id: "email-id" }, error: null });
    const service = new ResendMailService(
      "test-api-key",
      "onboarding@example.com",
      "Beryl Shelter Nigeria Limited"
    );

    await service.sendRegistrationOtp({
      to: "customer@example.com",
      fullName: "Test Customer",
      otp: "419205",
      expiresInMinutes: 10
    });

    expect(send).toHaveBeenCalledOnce();
    const message = send.mock.calls[0][0];
    expect(message.from).toBe(
      "Beryl Shelter Nigeria Limited <onboarding@example.com>"
    );
    expect(message.subject).toBe("Verify your Beryl Shelter account");
    expect(message.html).toContain("Beryl Shelter");
    expect(message.html).toContain("Beryl Shelter Nigeria Limited");
    expect(message.html).toContain("419205");
    expect(message.html).toContain("Do not share this code");
    expect(message.html).not.toContain("<img");
    expect(message.text).toContain("expires in 10 minutes");
  });

  it("rejects when Resend rejects delivery", async () => {
    send.mockResolvedValue({ data: null, error: { message: "Rejected" } });
    const service = new ResendMailService(
      "test-api-key",
      "onboarding@example.com",
      "Beryl Shelter Nigeria Limited"
    );

    await expect(
      service.sendRegistrationOtp({
        to: "customer@example.com",
        fullName: "Test Customer",
        otp: "419205",
        expiresInMinutes: 10
      })
    ).rejects.toThrow("Resend rejected the verification email");
  });

  it("sends a branded password-reset OTP without links or images", async () => {
    send.mockResolvedValue({ data: { id: "email-id" }, error: null });
    const service = new ResendMailService(
      "test-api-key",
      "onboarding@example.com",
      "Beryl Shelter Nigeria Limited"
    );

    await service.sendPasswordResetOtp({
      to: "customer@example.com",
      fullName: "Test Customer",
      otp: "419205",
      expiresInMinutes: 10
    });

    const message = send.mock.calls[0][0];
    expect(message.subject).toBe("Reset your Beryl Shelter password");
    expect(message.html).toContain("419205");
    expect(message.html).toContain("Beryl Shelter Nigeria Limited");
    expect(message.html).not.toContain("<img");
    expect(message.html).not.toContain("href=");
  });

  it("rejects a Gmail from address", () => {
    expect(
      () =>
        new ResendMailService(
          "test-api-key",
          "beryl@gmail.com",
          "Beryl Shelter Nigeria Limited"
        )
    ).toThrow("must not use a Gmail sender address");
  });
});
