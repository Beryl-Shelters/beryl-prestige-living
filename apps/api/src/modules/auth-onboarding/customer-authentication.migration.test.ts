import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/202608030002_customer_authentication_sessions.sql"
  ),
  "utf8"
);

describe("customer authentication session/password migration", () => {
  it("creates all seven service-role transaction RPCs", () => {
    for (const name of [
      "create_customer_session",
      "rotate_customer_session",
      "revoke_customer_session",
      "replace_customer_password_reset_otp",
      "verify_customer_password_reset_otp",
      "finalize_customer_password_reset",
      "change_customer_password"
    ]) {
      expect(migration).toContain(`function public.${name}`);
    }
    expect(migration.match(/to service_role/g)).toHaveLength(7);
    expect(migration.match(/from public, anon, authenticated/g)).toHaveLength(7);
  });

  it("rotates refresh sessions atomically and detects reuse", () => {
    expect(migration).toContain("p_replacement_session_id");
    expect(migration).toContain("replaced_by_session_id = p_replacement_session_id");
    expect(migration).toContain("REFRESH_TOKEN_REUSED");
    expect(migration).toContain("insert into public.customer_sessions");
  });

  it("stores reset proofs as hashes and enforces one-time expiry", () => {
    expect(migration).toContain("purpose = 'CUSTOMER_PASSWORD_RESET'");
    expect(migration).toContain("set invalidated_at = p_now");
    expect(migration).toContain("verified_proof_hash = p_proof_hash");
    expect(migration).toContain("verified_proof_expires_at");
    expect(migration).toContain("verified_proof_consumed_at");
    expect(migration).toContain("RESET_TOKEN_EXPIRED");
    expect(migration).toContain("RESET_TOKEN_USED");
  });

  it("changes passwords with session-version increment and revocation", () => {
    expect(migration).toContain("encrypted_password = crypt");
    expect(migration.match(/session_version = session_version \+ 1/g)).toHaveLength(2);
    expect(migration).toContain("NEW_PASSWORD_SAME_AS_CURRENT");
    expect(
      migration.match(/where user_id = .* and revoked_at is null/g)?.length
    ).toBeGreaterThanOrEqual(2);
    expect(migration).toContain("CURRENT_PASSWORD_INCORRECT");
    expect(migration).toContain("crypt(p_current_password");
    expect(migration.trim().startsWith("begin;")).toBe(true);
    expect(migration.trim().endsWith("commit;")).toBe(true);
  });
});
