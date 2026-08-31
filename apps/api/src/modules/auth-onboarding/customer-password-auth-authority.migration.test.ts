import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/202608310001_customer_password_auth_authority.sql"
  ),
  "utf8"
);

describe("customer password Auth authority migration", () => {
  it("adds replacement RPCs without mutating managed Auth passwords", () => {
    expect(migration).toContain("create or replace function public.consume_customer_password_reset_proof");
    expect(migration).toContain("create or replace function public.revoke_customer_sessions_for_password_change");
    expect(migration).not.toMatch(/encrypted_password|gen_salt|crypt\(p_(?:new|current)_password/i);
  });

  it("atomically consumes reset proofs using the database clock", () => {
    expect(migration).toContain("consume_customer_password_reset_proof");
    expect(migration).toContain("v_now timestamptz := clock_timestamp()");
    expect(migration).toContain("verified_proof_expires_at <= v_now");
    expect(migration).toContain("verified_proof_consumed_at = v_now");
    expect(migration).toContain("RESET_TOKEN_EXPIRED");
    expect(migration).toContain("RESET_TOKEN_USED");
    expect(migration).toContain("for update");
  });

  it("rejects a reset proof at the exact database-clock expiry boundary", () => {
    const proofStatus = (expiresAt: Date, databaseNow: Date) =>
      expiresAt.getTime() <= databaseNow.getTime()
        ? "RESET_TOKEN_EXPIRED"
        : "OK";
    const expiresAt = new Date("2026-08-31T10:10:00.000Z");

    expect(proofStatus(expiresAt, new Date("2026-08-31T10:09:59.999Z"))).toBe("OK");
    expect(proofStatus(expiresAt, new Date("2026-08-31T10:10:00.000Z"))).toBe("RESET_TOKEN_EXPIRED");
    expect(proofStatus(expiresAt, new Date("2026-08-31T10:10:00.001Z"))).toBe("RESET_TOKEN_EXPIRED");
  });

  it("invalidates every custom Customer session for reset and authenticated change", () => {
    expect(migration).toContain("revoke_customer_sessions_for_password_change");
    expect(migration.match(/session_version = session_version \+ 1/g)).toHaveLength(2);
    expect(migration.match(/revoked_at = coalesce\(revoked_at, v_now\)/g)).toHaveLength(2);
  });

  it("keeps both replacement RPCs service-role only", () => {
    expect(migration.match(/to service_role/g)).toHaveLength(2);
    expect(migration).toMatch(/revoke all on function public\.consume_customer_password_reset_proof\(text\)\s+from public, anon, authenticated/);
    expect(migration).toMatch(/revoke all on function public\.revoke_customer_sessions_for_password_change\(uuid\)\s+from public, anon, authenticated/);
    expect(migration.trim().startsWith("begin;")).toBe(true);
    expect(migration.trim().endsWith("commit;")).toBe(true);
  });
});
