import { describe, expect, it } from "vitest";
import { swaggerSpec } from "./swagger";

describe("Admin Users OpenAPI", () => {
  const spec = swaggerSpec as any;
  it("documents read-only list and detail with Admin authorization", () => {
    expect(spec.paths["/admin/users"].get).toMatchObject({ tags: ["Admin Users"], security: [{ bearerAuth: [] }] });
    expect(spec.paths["/admin/users/{userId}"].get).toMatchObject({ tags: ["Admin Users"], security: [{ bearerAuth: [] }] });
    expect(spec.paths["/admin/users"].post).toBeUndefined();
    expect(spec.paths["/admin/users/{userId}"].patch).toBeUndefined();
  });
  it("documents counts, pagination, safe detail, and stable errors", () => {
    expect(spec.components.schemas.AdminUserCounts).toBeDefined();
    expect(spec.components.schemas.AdminUsersDirectory).toBeDefined();
    expect(spec.components.schemas.AdminUserDetail).toBeDefined();
    expect(spec.paths["/admin/users"].get.responses[400].content["application/json"].examples).toBeDefined();
    expect(spec.paths["/admin/users/{userId}"].get.responses[404].content["application/json"].example.code).toBe("ADMIN_USER_NOT_FOUND");
  });
});
