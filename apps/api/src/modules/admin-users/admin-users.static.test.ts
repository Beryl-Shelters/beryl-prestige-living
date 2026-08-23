import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd().endsWith("apps\\api") || process.cwd().endsWith("apps/api") ? process.cwd() : join(process.cwd(), "apps", "api");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const routes = source("src/modules/admin-users/admin-users.routes.ts");
const controller = source("src/modules/admin-users/admin-users.controller.ts");
const service = source("src/modules/admin-users/admin-users.service.ts");
const validators = source("src/modules/admin-users/admin-users.validators.ts");
const migration = source("supabase/migrations/202608240001_admin_users_directory.sql");

describe("Admin Users read-only architecture", () => {
  it("uses only isolated ADMIN and SUPER_ADMIN sessions", () => {
    expect(routes).toContain('adminSessionMiddleware, requireAdminRole("ADMIN", "SUPER_ADMIN")');
    expect(routes).not.toMatch(/customerSessionMiddleware|authMiddleware|requireVerifiedCustomer/);
  });
  it("mounts only list and detail GET operations", () => {
    expect(routes).toContain('router.get("/", controller.list)');
    expect(routes).toContain('router.get("/:userId", controller.detail)');
    expect(routes).not.toMatch(/router\.(post|patch|put|delete)/);
  });
  it("validates UUID, filters, sort, and pagination", () => {
    expect(validators).toContain("z.string().uuid()");
    expect(validators).toContain('["BUYER", "SELLER", "REFERRER"]');
    expect(validators).toContain('["VERIFIED", "UNVERIFIED"]');
    expect(validators).toContain('["MOST_RECENT", "OLDEST", "NAME_ASC", "NAME_DESC"]');
    expect(validators).toContain(".max(120)");
    expect(validators).toContain(".max(50)");
  });
  it("returns stable safe validation and persistence errors", () => {
    ["INVALID_USER_FILTER", "INVALID_USER_SORT"].forEach((code) => expect(controller).toContain(code));
    ["ADMIN_USER_NOT_FOUND", "USERS_UNAVAILABLE"].forEach((code) => expect(service).toContain(code));
  });
  it("uses the canonical verification timestamp and explicit selects", () => {
    expect(service).toContain("email_verified_at");
    expect(service).not.toMatch(/select\("\*"\)/);
    expect(service).not.toMatch(/password|refresh_token|provider_metadata/);
  });
  it("uses completion status and completion timestamps for activation", () => {
    expect(service).toContain('onboarding_status === "COMPLETED"');
    expect(service).toContain("onboarding_completed_at");
  });
  it("maps canonical Seller profile values without inventing fields", () => {
    ["profile_type", "company_name", "company_address"].forEach((field) => expect(service).toContain(field));
    ["cac_number", "website", "staff_count"].forEach((field) => expect(service).not.toContain(field));
  });
  it("uses one parameterized list RPC without N+1 list queries", () => {
    expect(service).toContain('rpc("list_admin_customer_users"');
    expect(migration).toContain("btrim(p_query)");
    expect(migration).not.toContain("execute format");
  });
  it("counts only canonical customers and activated profiles", () => {
    expect(migration).toContain("public.customer_records");
    expect(migration).toContain("up.onboarding_status = 'COMPLETED'");
    expect(migration).toContain("count(*) filter (where buyer_activated)");
    expect(migration).toContain("count(*) filter (where seller_activated)");
    expect(migration).toContain("count(*) filter (where referrer_activated)");
  });
  it("uses email_verified_at rather than legacy verification", () => {
    expect(migration).toContain("p.email_verified_at");
    expect(migration).not.toMatch(/verification_status|email_verified(?:\s|,|\))/);
  });
  it("implements server search, role, verification, sort, and page bounds", () => {
    ["full_name ilike", "email ilike", "phone_number ilike", "p_role", "p_verification", "p_sort", "offset", "limit"].forEach((value) => expect(migration.toLowerCase()).toContain(value));
    expect(migration).toContain("id asc");
  });
  it("keeps the RPC service-role only", () => {
    expect(migration).toMatch(/revoke all on function public\.list_admin_customer_users[\s\S]*from public, anon, authenticated/);
    expect(migration).toContain("to service_role");
  });
});
