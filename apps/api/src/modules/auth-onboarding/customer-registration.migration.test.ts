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
  const registrationStore = readFileSync(
    join(process.cwd(), "src/modules/auth-onboarding/supabase-customer-registration.store.ts"),
    "utf8"
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

  it("uses the database clock and rejects the exact OTP expiry boundary before matching", () => {
    const rpcStart = registrationStore.indexOf('.rpc("verify_customer_email_otp"');
    const rpcEnd = registrationStore.indexOf(".single()", rpcStart);
    const verifyRpcCall = registrationStore.slice(rpcStart, rpcEnd);
    const activeChallenge = verification.indexOf("select oc.*\n  into v_challenge");
    const expiry = verification.indexOf("v_challenge.expires_at <= p_now", activeChallenge);
    const attempts = verification.indexOf("v_challenge.attempt_count >=", activeChallenge);
    const match = verification.indexOf("not public.secure_hash_equals", activeChallenge);
    const consume = verification.indexOf("set consumed_at = p_now", activeChallenge);

    expect(rpcStart).toBeGreaterThan(-1);
    expect(verifyRpcCall).not.toContain("p_now");
    expect(verification).toContain("p_now timestamptz default now()");
    expect(foundation).toContain("expires_at timestamptz not null");
    expect(expiry).toBeGreaterThan(activeChallenge);
    expect(attempts).toBeGreaterThan(expiry);
    expect(match).toBeGreaterThan(attempts);
    expect(consume).toBeGreaterThan(match);
  });

  it("invalidates an expired challenge without spending an invalid-code attempt", () => {
    const expiryBranch = verification.slice(
      verification.indexOf("if v_challenge.expires_at <= p_now then"),
      verification.indexOf("if v_challenge.attempt_count >=", verification.indexOf("if v_challenge.expires_at <= p_now then"))
    );

    expect(expiryBranch).toContain("set invalidated_at = p_now");
    expect(expiryBranch).toContain("'OTP_EXPIRED'");
    expect(expiryBranch).not.toContain("attempt_count = attempt_count + 1");
  });

  it("restricts verification RPC execution to the service role", () => {
    expect(verification).toContain("from public, anon, authenticated");
    expect(verification).toContain("to service_role");
    expect(verification.trim().startsWith("begin;")).toBe(true);
    expect(verification.trim().endsWith("commit;")).toBe(true);
  });
});
