import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/202608070002_complete_first_admin_password_change.sql"), "utf8");

describe("first Admin password-change migration", () => {
  it("is transactional and service-role-only", () => {
    expect(migration.trim().startsWith("begin;")).toBe(true);
    expect(migration.trim().endsWith("commit;")).toBe(true);
    expect(migration).toContain("function public.complete_first_admin_password_change");
    expect(migration).toContain("from public,anon,authenticated");
    expect(migration).toContain("to service_role");
  });

  it("consumes the restricted proof and invalidates Admin sessions atomically", () => {
    expect(migration).toContain("verified_proof_hash");
    expect(migration).toContain("verified_proof_consumed_at=p_now");
    expect(migration).toContain("password_hash=p_password_hash");
    expect(migration).toContain("requires_password_change=false");
    expect(migration).toContain("session_version=session_version+1");
    expect(migration).toContain("update public.admin_sessions set revoked_at");
  });
});
