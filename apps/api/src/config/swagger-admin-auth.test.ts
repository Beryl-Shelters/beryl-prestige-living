import { describe, expect, it } from "vitest";
import { swaggerSpec } from "./swagger";

describe("Admin authentication Swagger coverage", () => {
  it("documents all isolated Admin authentication and staff routes", () => {
    const paths = (swaggerSpec as { paths?: Record<string, unknown> }).paths ?? {};
    [
      "/admin/staff", "/admin/staff/invite", "/admin/staff/{adminId}/resend-invitation",
      "/admin/auth/activate", "/admin/auth/resend-activation-otp",
      "/admin/auth/verify-activation-otp", "/admin/auth/set-password"
    ].forEach((path) => expect(paths[path]).toBeDefined());
    expect(paths["/admin/users"]).toBeDefined();
    ["/admin/auth/login", "/admin/auth/resend-login-otp", "/admin/auth/verify-login-otp"].forEach((path) => expect(paths[path]).toBeDefined());
    expect(paths["/admin/auth/complete-first-password-change"]).toBeDefined();
    ["/admin/auth/refresh", "/admin/auth/logout", "/admin/auth/change-password"].forEach((path) => expect(paths[path]).toBeDefined());
    expect((paths["/admin/auth/logout"] as { post: { security: unknown } }).post.security).toEqual([{ bearerAuth: [] }]);
    expect((paths["/admin/auth/change-password"] as { patch: { security: unknown } }).patch.security).toEqual([{ bearerAuth: [] }]);
  });
});
