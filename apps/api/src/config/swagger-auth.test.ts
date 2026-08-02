import { describe, expect, it } from "vitest";
import { swaggerSpec } from "./swagger";

describe("customer registration Swagger contracts", () => {
  const specification = swaggerSpec as any;

  it("documents the three mounted customer registration endpoints", () => {
    expect(specification.paths["/auth/register"].post.responses[201]).toBeDefined();
    expect(specification.paths["/auth/verify-email"].post.responses[200]).toBeDefined();
    expect(
      specification.paths["/auth/resend-verification-otp"].post.responses[202]
    ).toBeDefined();
  });

  it("documents required registration fields and conflict errors", () => {
    const schema = specification.components.schemas.RegisterRequest;
    expect(schema.required).toEqual(
      expect.arrayContaining([
        "fullName",
        "email",
        "phone",
        "isWhatsAppNumber",
        "gettingStartedAs",
        "password",
        "confirmPassword"
      ])
    );
    const conflictExamples =
      specification.paths["/auth/register"].post.responses[409].content[
        "application/json"
      ].examples;
    expect(conflictExamples.email.value.code).toBe("EMAIL_ALREADY_REGISTERED");
    expect(conflictExamples.phone.value.code).toBe("PHONE_ALREADY_REGISTERED");
    expect(schema.properties.password.pattern).toContain("A-Z");
    expect(schema.properties.password.pattern).toContain("a-z");
  });

  it("documents frontend OTP attempt and cooldown state", () => {
    const invalidExamples =
      specification.paths["/auth/verify-email"].post.responses[400].content[
        "application/json"
      ].examples;
    const cooldownExamples =
      specification.paths["/auth/resend-verification-otp"].post.responses[429]
        .content["application/json"].examples;

    expect(invalidExamples.invalid.value).toMatchObject({
      code: "INVALID_OTP",
      attemptsRemaining: 2
    });
    expect(cooldownExamples.cooldown.value).toMatchObject({
      code: "OTP_RESEND_COOLDOWN",
      retryAfter: 38
    });
  });

  it("does not place an OTP value in the verification example", () => {
    const serialized = JSON.stringify(
      specification.paths["/auth/verify-email"].post.requestBody
    );
    expect(serialized).not.toMatch(/"otp"\s*:\s*"\d{6}"/);
  });

  it("preserves /admin/users as the Admin Portal customer-user listing", () => {
    expect(specification.paths["/admin/users"].get.summary).toBe("List users");
    expect(specification.paths["/admin/users"].get.description).toContain(
      "Admin or Super Admin"
    );
  });
});
