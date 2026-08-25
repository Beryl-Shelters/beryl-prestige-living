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

  it("documents Super-Admin management authorization, safe DTOs, and stable invitation errors", () => {
    const specification = swaggerSpec as { paths?: Record<string, Record<string, Record<string, unknown>>>; components?: { schemas?: Record<string, Record<string, unknown>> } };
    const paths = specification.paths ?? {};
    const invite = paths["/admin/staff/invite"].post;
    const list = paths["/admin/staff"].get;
    const activate = paths["/admin/auth/activate"].post;
    expect(invite.security).toEqual([{ bearerAuth: [] }]);
    expect(invite.description).toContain("Required role(s): SUPER_ADMIN");
    expect(list.security).toEqual([{ bearerAuth: [] }]);
    expect(list.description).toContain("Required role(s): SUPER_ADMIN");
    expect(activate.security).toEqual([]);
    for (const status of ["403", "409", "503"]) expect((invite.responses as Record<string, unknown>)[status]).toBeDefined();
    for (const status of ["400", "401", "409", "503"]) expect((activate.responses as Record<string, unknown>)[status]).toBeDefined();
    const schemas = specification.components?.schemas ?? {};
    expect(schemas.AdminStaffList).toMatchObject({ type: "array" });
    expect((schemas.AdminStaff.properties as Record<string, unknown>).adminRole).toBeDefined();
    expect((schemas.AdminStaff.properties as Record<string, unknown>)).not.toHaveProperty("passwordHash");
    expect((schemas.AdminActivationRequest.properties as Record<string, { writeOnly?: boolean }>).invitationToken.writeOnly).toBe(true);
    expect((schemas.AdminActivationRequest.properties as Record<string, { writeOnly?: boolean }>).temporaryPassword.writeOnly).toBe(true);
  });
});
