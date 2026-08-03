import { describe, expect, it } from "vitest";
import { swaggerSpec } from "./swagger";

describe("customer registration Swagger contracts", () => {
  const specification = swaggerSpec as any;

  it("uses the current customer-facing API brand", () => {
    expect(specification.info.title).toBe("Beryl Shelter Nigeria Limited API");
    expect(specification.info.description).toContain(
      "Beryl Shelter Nigeria Limited"
    );
  });

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

  it("documents all six mounted onboarding and persona operations", () => {
    expect(specification.paths["/onboarding/status"].get).toBeDefined();
    expect(specification.paths["/onboarding/buyer"].patch).toBeDefined();
    expect(specification.paths["/onboarding/seller"].patch).toBeDefined();
    expect(specification.paths["/personas"].get).toBeDefined();
    expect(specification.paths["/personas/activate"].post).toBeDefined();
    expect(specification.paths["/personas/active"].patch).toBeDefined();
  });

  it("requires bearer authentication and customer-state errors on the new slice", () => {
    for (const [path, method] of [
      ["/onboarding/status", "get"],
      ["/onboarding/buyer", "patch"],
      ["/onboarding/seller", "patch"],
      ["/personas", "get"],
      ["/personas/activate", "post"],
      ["/personas/active", "patch"]
    ]) {
      const operation = specification.paths[path][method];
      expect(operation.security).toEqual([{ bearerAuth: [] }]);
      expect(operation.responses[401]).toBeDefined();
      expect(operation.responses[403]).toBeDefined();
      expect(operation.responses[500]).toBeDefined();
    }
  });

  it("documents strict skip and conditional Seller contracts", () => {
    const buyer = specification.components.schemas.BuyerOnboardingRequest;
    const seller = specification.components.schemas.SellerOnboardingRequest;

    expect(buyer.oneOf[0].required).toContain("skip");
    expect(buyer.oneOf[1].properties.currency.enum).toEqual([
      "NGN",
      "USD",
      "GBP",
      "EUR"
    ]);
    expect(seller.description).toContain("BUSINESS requires companyName");
    expect(
      specification.paths["/onboarding/seller"].patch.responses[409]
    ).toBeDefined();
  });

  it("does not expose secrets or user identity fields in the new request bodies", () => {
    const schemas = JSON.stringify({
      buyer: specification.components.schemas.BuyerOnboardingRequest,
      seller: specification.components.schemas.SellerOnboardingRequest,
      persona: specification.components.schemas.PersonaTypeRequest
    });

    expect(schemas).not.toMatch(/password|token|secret|userId|user_id/i);
  });

  it("documents all seven mounted customer session and password operations", () => {
    for (const [path, method, status] of [
      ["/auth/login", "post", 200],
      ["/auth/forgot-password", "post", 202],
      ["/auth/verify-password-reset-otp", "post", 200],
      ["/auth/reset-password", "post", 200],
      ["/auth/refresh", "post", 200],
      ["/auth/logout", "post", 200],
      ["/auth/change-password", "patch", 200]
    ] as const) {
      expect(specification.paths[path][method].responses[status]).toBeDefined();
      expect(specification.paths[path][method].requestBody).toBeDefined();
    }
  });

  it("documents the exact strict customer authentication request fields", () => {
    expect(specification.components.schemas.CustomerLoginRequest.required).toEqual([
      "identifier",
      "password"
    ]);
    expect(
      specification.components.schemas.ResetCustomerPasswordRequest.required
    ).toEqual(["resetToken", "newPassword", "confirmPassword"]);
    expect(
      specification.components.schemas.ChangeCustomerPasswordRequest.required
    ).toEqual(["currentPassword", "newPassword", "confirmPassword"]);
    expect(specification.components.schemas.CustomerRefreshRequest.required).toEqual([
      "refreshToken"
    ]);
    expect(specification.components.schemas.CustomerLogoutRequest.required).toEqual([
      "refreshToken"
    ]);
  });

  it("requires customer bearer access only for logout and password change", () => {
    expect(specification.paths["/auth/logout"].post.security).toEqual([
      { bearerAuth: [] }
    ]);
    expect(specification.paths["/auth/change-password"].patch.security).toEqual([
      { bearerAuth: [] }
    ]);
    expect(specification.paths["/auth/login"].post.security).toEqual([]);
    expect(specification.paths["/auth/refresh"].post.security).toEqual([]);
  });

  it("documents rotating refresh, reuse detection, and reset-proof failures", () => {
    const refreshExamples =
      specification.paths["/auth/refresh"].post.responses[401].content[
        "application/json"
      ].examples;
    const resetExamples =
      specification.paths["/auth/reset-password"].post.responses[401].content[
        "application/json"
      ].examples;

    expect(refreshExamples.reused.value.code).toBe("REFRESH_TOKEN_REUSED");
    expect(refreshExamples.revoked.value.code).toBe("REFRESH_TOKEN_REVOKED");
    expect(resetExamples.expired.value.code).toBe("RESET_TOKEN_EXPIRED");
    expect(
      specification.components.schemas.ValidationError.properties.code.enum
    ).toEqual(
      expect.arrayContaining([
        "PASSWORD_VALIDATION_ERROR",
        "NEW_PASSWORD_SAME_AS_CURRENT"
      ])
    );
  });

  it("uses placeholders rather than realistic OTP or token values", () => {
    const authSlice = JSON.stringify({
      login: specification.paths["/auth/login"],
      verify: specification.paths["/auth/verify-password-reset-otp"],
      reset: specification.paths["/auth/reset-password"],
      refresh: specification.paths["/auth/refresh"]
    });

    expect(authSlice).not.toMatch(/"otp"\s*:\s*"\d{6}"/);
    expect(authSlice).not.toMatch(/eyJ[A-Za-z0-9_-]+\./);
    expect(authSlice).toContain("<customer-access-token>");
  });
});
