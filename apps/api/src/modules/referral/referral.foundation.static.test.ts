import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REFERRAL_BANK_DIRECTORY } from "./referral.banks";
import { referralStatusLabel } from "./referral.types";

const root = process.cwd();
const migration = readFileSync(join(root, "supabase/migrations/202608280001_referral_platform_foundation.sql"), "utf8");
const service = readFileSync(join(root, "src/modules/referral/referral.service.ts"), "utf8");
const routes = readFileSync(join(root, "src/modules/referral/referral.routes.ts"), "utf8");
const provider = readFileSync(join(root, "src/modules/referral/referral.provider.ts"), "utf8");
const swagger = readFileSync(join(root, "src/config/swagger.ts"), "utf8");

describe("referral platform foundation", () => {
  it("links customer identities to profiles without requiring that link for guests", () => {
    expect(migration).toContain("customer_user_id uuid unique references public.profiles");
    expect(migration).toContain("customer_user_id is not null or phone_e164 is not null");
    expect(service).toContain('.eq("phone_e164", profilePhone)');
    expect(service).toContain("customer_user_id: customerUserId");
  });
  it("backfills and reuses profiles.referral_code", () => {
    expect(migration).toContain("p.referral_code");
    expect(service).toContain("profile.data.referral_code || newReferralCode()");
  });
  it("reuses the canonical referrals table", () => expect(migration).toContain("alter table public.referrals"));
  it("generates display references on the server", () => {
    expect(migration).toContain("generate_referral_display_reference");
    expect(migration).toContain("alter column reference_id set default");
  });
  it("defines one canonical lifecycle and payment model", () => {
    expect(migration).toContain("'NEW','CONTACTED','IN_PROGRESS','COMPLETED','LOST'");
    expect(migration).toContain("'NOT_ELIGIBLE','OUTSTANDING','PAID'");
  });
  it("maps lifecycle labels centrally", () => {
    expect(referralStatusLabel("NEW")).toBe("New");
    expect(referralStatusLabel("CONTACTED")).toBe("In Progress");
    expect(referralStatusLabel("LOST")).toBe("Didn't proceed");
  });
  it("does not calculate a reward from property price", () => {
    expect(service).not.toMatch(/price\s*\*\s*0?\.25/);
    expect(service).toContain("reward_amount: null");
  });
  it("aggregates only completed authoritative rewards", () => expect(service).toContain('row.lifecycle_status === "COMPLETED" && row.reward_amount !== null'));
  it("keeps guest tracking sessions separate from customer tokens", () => {
    expect(migration).toContain("referral_tracking_sessions");
    expect(service).not.toContain("issueCustomerAccessToken");
  });
  it("hashes OTP codes and opaque session tokens", () => {
    expect(service).toContain("hashReferralSecret(`${code}:${env.otpSecret}`)");
    expect(service).toContain("token_hash: hashReferralSecret(token)");
  });
  it("has cooldown, expiry, attempt and rate protections", () => {
    expect(service).toContain("OTP_RESEND_SECONDS");
    expect(service).toContain("OTP_MAX_ATTEMPTS");
    expect(routes).toContain("referralOtpRequestRateLimiter");
  });
  it("uses an explicit unavailable delivery adapter", () => {
    expect(provider).toContain("available: false");
    expect(provider).toContain("REFERRAL_TRACKING_UNAVAILABLE");
  });
  it("returns explicit referral dashboard columns rather than wildcard rows", () => {
    const dashboardSelect = service.match(/\.select\("id,reference_id,referred_full_name[^\n]+/s)?.[0] || "";
    expect(dashboardSelect).not.toContain("referred_contact_value");
    expect(dashboardSelect).not.toContain("*");
  });
  it("encrypts payout account numbers and stores only last four for safe DTOs", () => {
    expect(migration).toContain("account_number_ciphertext");
    expect(migration).not.toContain("account_number text");
    expect(service).toContain("maskedAccountNumber");
  });
  it("enables RLS on every new sensitive relation", () => {
    for (const table of ["referrers", "referrer_payout_details", "referral_tracking_challenges", "referral_tracking_sessions", "referral_payments"]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
  });
  it("includes the approved fintech institutions without claiming completeness", () => {
    const names = REFERRAL_BANK_DIRECTORY.map((bank) => bank.name);
    expect(names).toEqual(expect.arrayContaining(["OPay", "PalmPay", "Moniepoint Microfinance Bank"]));
    expect(REFERRAL_BANK_DIRECTORY.length).toBeGreaterThan(20);
    expect(service).toContain("authoritativeCompleteDirectory: false");
  });
  it("leaves a protected canonical payment receipt record for the Admin phase", () => {
    expect(migration).toContain("receipt_storage_public_id");
    expect(migration).toContain("recorded_by_admin_id");
  });
  it("documents the public, customer, and referral-session contracts without private payout data", () => {
    for (const path of [
      "/referrals/context",
      "/referrals/links/{code}",
      "/referrals/tracking/request",
      "/referrals/tracking/verify",
      "/referrals/dashboard",
      "/referrals/payout-details"
    ]) expect(swagger).toContain(path);
    expect(swagger).toContain("maskedAccountNumber");
    expect(swagger).not.toContain("accountNumberCiphertext");
  });
});
