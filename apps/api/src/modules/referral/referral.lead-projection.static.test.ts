import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = readFileSync(join(root, "supabase/migrations/202609010001_referral_admin_lead_projection.sql"), "utf8");
const service = readFileSync(join(root, "src/modules/referral/referral.service.ts"), "utf8");

describe("referral Admin Lead projection migration", () => {
  it("adds an optional one-to-one referral relationship without historical backfill", () => {
    expect(migration).toContain("add column if not exists lead_inquiry_id uuid");
    expect(migration).toContain("references public.inquiries(id)");
    expect(migration).toContain("on delete restrict");
    expect(migration).toContain("create unique index if not exists referrals_lead_inquiry_uidx");
    expect(migration).toContain("create trigger referrals_lead_inquiry_immutable");
    expect(migration).toContain("Referral Lead projection is immutable");
    expect(migration).not.toMatch(/update public\.referrals[\s\S]*set lead_inquiry_id[\s\S]*where lead_inquiry_id is null/i);
  });

  it("uses one transaction RPC for referral, Lead, and relationship persistence", () => {
    expect(migration).toMatch(/create or replace function public\.create_referral_with_lead[\s\S]*insert into public\.referrals[\s\S]*insert into public\.inquiries[\s\S]*set lead_inquiry_id = v_lead_id/);
    expect(service).toContain('rpc("create_referral_with_lead"');
    expect(service).not.toContain('from("referrals").insert');
  });

  it("supports nullable referral contacts without dummy values or weakening ordinary validation", () => {
    expect(migration).toContain("v_email text := nullif");
    expect(migration).toContain("v_phone text := nullif");
    expect(migration).not.toMatch(/N\/A|unknown@|000000|noemail/i);
    expect(migration).not.toMatch(/alter table public\.inquiries[\s\S]*alter column (email|phone_number)/i);
  });

  it("creates property-independent NEW Leads and no global person dedupe", () => {
    expect(migration).toMatch(/insert into public\.inquiries[\s\S]*values \([\s\S]*null,[\s\S]*null,[\s\S]*'REFERRAL_'/);
    expect(migration).toContain("'NEW'");
    expect(migration).not.toMatch(/unique\s*\([^)]*(email|phone_number)/i);
  });

  it("keeps the RPC service-role-only with a safe search path", () => {
    expect(migration).toMatch(/security definer[\s\S]*set search_path = public, pg_temp/);
    expect(migration).toMatch(/revoke all on function public\.create_referral_with_lead[\s\S]*from public, anon, authenticated/);
    expect(migration).toMatch(/grant execute on function public\.create_referral_with_lead[\s\S]*to service_role/);
  });

  it("derives source and bounded referrer identity from the authoritative relationship", () => {
    expect(migration).toContain("case when r.id is not null then 'REFERRAL'");
    expect(migration).toContain("left join public.referrals r on r.lead_inquiry_id = i.id");
    expect(migration).toContain("left join public.referrers rr on rr.id = r.referrer_identity_id");
    expect(migration).not.toMatch(/account_number|token_hash|code_hash/);
  });
});
