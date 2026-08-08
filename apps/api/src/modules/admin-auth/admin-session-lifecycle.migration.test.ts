import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/202608070003_admin_session_lifecycle.sql"), "utf8");
describe("Admin session lifecycle migration", () => {
  it("uses transactional service-role-only RPCs", () => {
    expect(migration.trim().startsWith("begin;")).toBe(true);
    expect(migration.trim().endsWith("commit;")).toBe(true);
    expect(migration).toContain("security definer set search_path = public, pg_temp");
    expect(migration).toContain("to service_role");
    expect(migration).toContain("from public,anon,authenticated");
  });
  it("atomically rotates, detects reuse, revokes sessions, and invalidates password sessions", () => {
    expect(migration).toContain("replaced_by_session_id");
    expect(migration).toContain("REFRESH_TOKEN_REUSED");
    expect(migration).toContain("secure_hash_equals");
    expect(migration).toContain("session_version=session_version+1");
    expect(migration).toContain("update public.admin_sessions set revoked_at");
  });
});
