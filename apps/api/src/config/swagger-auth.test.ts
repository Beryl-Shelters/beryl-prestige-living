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
    expect(specification.paths["/auth/register"].post.responses[409]).toBeDefined();
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
