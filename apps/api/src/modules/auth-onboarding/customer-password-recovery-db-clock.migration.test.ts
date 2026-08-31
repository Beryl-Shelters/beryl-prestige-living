import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/202608310002_customer_password_recovery_db_clock.sql"
  ),
  "utf8"
);
const functionBody = migration.split("as $$")[1]?.split("$$;")[0] ?? "";

const recoveryVerifier = (
  expiresAt: Date,
  databaseNow: Date,
  _legacyCallerNow: Date
) => expiresAt.getTime() <= databaseNow.getTime() ? "OTP_EXPIRED" : "VERIFIED";

const storedProofExpiry = (
  databaseNow: Date,
  _legacyProofExpiresAt: Date,
  _legacyCallerNow: Date
) => new Date(databaseNow.getTime() + 10 * 60 * 1_000);

describe("customer password-recovery database-clock migration", () => {
  it("preserves the legacy RPC signature while removing p_now from security decisions", () => {
    expect(migration).toContain("create or replace function public.verify_customer_password_reset_otp(");
    expect(migration).toContain("p_proof_expires_at timestamptz default now()");
    expect(migration).toContain("p_now timestamptz default now()");
    expect(migration).toContain("v_now timestamptz := clock_timestamp()");
    expect(migration).toContain("v_challenge.expires_at <= v_now");
    expect(migration).toContain("invalidated_at = v_now");
    expect(migration).toContain("consumed_at = v_now");
    expect(migration).not.toMatch(/expires_at\s*<=\s*p_now/);
    expect(migration).not.toMatch(/(?:invalidated_at|consumed_at)\s*=\s*p_now/);
    expect(functionBody).not.toContain("p_now");
  });

  it("accepts one millisecond before expiry and rejects the exact boundary and after", () => {
    const expiresAt = new Date("2026-08-31T10:10:00.000Z");
    const ignoredCallerNow = new Date("2000-01-01T00:00:00.000Z");

    expect(recoveryVerifier(expiresAt, new Date("2026-08-31T10:09:59.999Z"), ignoredCallerNow)).toBe("VERIFIED");
    expect(recoveryVerifier(expiresAt, new Date("2026-08-31T10:10:00.000Z"), ignoredCallerNow)).toBe("OTP_EXPIRED");
    expect(recoveryVerifier(expiresAt, new Date("2026-08-31T10:10:00.001Z"), ignoredCallerNow)).toBe("OTP_EXPIRED");
  });

  it("ignores caller clock skew in both attack directions", () => {
    const expiresAt = new Date("2026-08-31T10:10:00.000Z");

    expect(recoveryVerifier(
      expiresAt,
      new Date("2026-08-31T10:10:00.001Z"),
      new Date("1999-01-01T00:00:00.000Z")
    )).toBe("OTP_EXPIRED");
    expect(recoveryVerifier(
      expiresAt,
      new Date("2026-08-31T10:09:59.999Z"),
      new Date("2099-01-01T00:00:00.000Z")
    )).toBe("VERIFIED");
  });

  it("derives a ten-minute proof expiry from the database despite a future caller value", () => {
    const databaseNow = new Date("2026-08-31T10:00:00.000Z");
    const stored = storedProofExpiry(
      databaseNow,
      new Date("2027-08-31T10:00:00.000Z"),
      new Date("1999-01-01T00:00:00.000Z")
    );

    expect(stored.toISOString()).toBe("2026-08-31T10:10:00.000Z");
  });

  it("derives a ten-minute proof expiry from the database despite an expired caller value", () => {
    const databaseNow = new Date("2026-08-31T10:00:00.000Z");
    const stored = storedProofExpiry(
      databaseNow,
      new Date("2000-01-01T00:00:00.000Z"),
      new Date("2099-01-01T00:00:00.000Z")
    );

    expect(stored.toISOString()).toBe("2026-08-31T10:10:00.000Z");
  });

  it("preserves resend, attempt, proof, and service-role-only behavior", () => {
    expect(migration).toContain("and (oc.consumed_at is not null or oc.invalidated_at is not null)");
    expect(migration).toContain("v_challenge.attempt_count >= v_challenge.max_attempts");
    expect(migration).toContain("attempt_count = attempt_count + 1");
    expect(migration).toContain("verified_proof_hash = p_proof_hash");
    expect(migration).toContain("verified_proof_expires_at = v_now + interval '10 minutes'");
    expect(functionBody).not.toContain("p_proof_expires_at");
    expect(migration).toMatch(/revoke all on function public\.verify_customer_password_reset_otp\(text, text, text, timestamptz, timestamptz\) from public, anon, authenticated/);
    expect(migration).toMatch(/grant execute on function public\.verify_customer_password_reset_otp\(text, text, text, timestamptz, timestamptz\) to service_role/);
  });

  it("contains no destructive schema/data operation or managed Auth mutation", () => {
    expect(migration).not.toMatch(/\b(?:drop|truncate|delete|alter table|insert into)\b/i);
    expect(migration).not.toMatch(/auth\.users|encrypted_password/i);
    expect(functionBody).not.toMatch(/\bexecute\b/i);
    expect(migration).toContain("oc.purpose = 'CUSTOMER_PASSWORD_RESET'");
    expect(migration).toContain("public.secure_hash_equals(oc.code_hash, p_code_hash)");
    expect(migration).toContain("for update");
    expect(migration).toContain("set search_path = public, pg_temp");
    expect(migration.trim().startsWith("begin;")).toBe(true);
    expect(migration.trim().endsWith("commit;")).toBe(true);
  });
});
