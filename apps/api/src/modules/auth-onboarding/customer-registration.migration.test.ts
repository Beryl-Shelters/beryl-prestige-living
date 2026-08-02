import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = (name: string) =>
  readFileSync(join(process.cwd(), "supabase/migrations", name), "utf8");

describe("customer registration migrations", () => {
  const foundation = migration("202607280001_auth_onboarding_foundation.sql");
  const verification = migration(
    "202607280002_customer_registration_verification_rpc.sql"
  );

  it("enforces normalized customer identifiers and idempotent projections", () => {
    expect(foundation).toContain("profiles_email_normalized_uidx");
    expect(foundation).toContain("profiles_phone_normalized_uidx");
    expect(foundation).toContain("unique (user_id, persona_type)");
    expect(foundation).toContain("unique (user_id)");
  });

  it("keeps sensitive authentication tables behind RLS", () => {
    for (const table of [
      "user_personas",
      "customer_records",
      "otp_challenges",
      "customer_sessions"
    ]) {
      expect(foundation).toContain(
        `alter table public.${table} enable row level security`
      );
    }
    expect(foundation).not.toMatch(/create\s+policy/i);
  });

  it("atomically consumes OTP and confirms every account projection", () => {
    const consume = verification.indexOf("set consumed_at = p_now");
    const confirmAuth = verification.indexOf("update auth.users");
    const activateProfile = verification.indexOf("update public.profiles");
    const createPersona = verification.indexOf("insert into public.user_personas");
    const syncCustomer = verification.indexOf("insert into public.customer_records");

    expect(consume).toBeGreaterThan(-1);
    expect(confirmAuth).toBeGreaterThan(consume);
    expect(activateProfile).toBeGreaterThan(confirmAuth);
    expect(createPersona).toBeGreaterThan(activateProfile);
    expect(syncCustomer).toBeGreaterThan(createPersona);
    expect(verification).toContain("on conflict (user_id, persona_type) do nothing");
    expect(verification).toContain("on conflict (user_id) do update");
  });

  it("restricts verification RPC execution to the service role", () => {
    expect(verification).toContain("from public, anon, authenticated");
    expect(verification).toContain("to service_role");
    expect(verification.trim().startsWith("begin;")).toBe(true);
    expect(verification.trim().endsWith("commit;")).toBe(true);
  });
});
