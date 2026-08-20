import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const migration = readFileSync(path.resolve(__dirname, "../../../supabase/migrations/202608180002_marketplace_submit_for_review.sql"), "utf8");
const enumCastFix = readFileSync(path.resolve(__dirname, "../../../supabase/migrations/202608200002_marketplace_submit_for_review_enum_cast.sql"), "utf8");

describe("Marketplace submit-for-review migration", () => {
  it("adds a server submission timestamp and an atomic service-role-only RPC", () => {
    expect(migration).toContain("marketplace_submitted_at timestamptz");
    expect(migration).toContain("submit_marketplace_property_for_review");
    expect(migration).toMatch(/for update/i);
    expect(migration).toMatch(/marketplace_status = 'IN_REVIEW'/i);
    expect(migration).toMatch(/marketplace_current_step = 'REVIEW'/i);
    expect(migration).toMatch(/marketplace_submitted_at = now\(\)/i);
    expect(migration).toMatch(/grant execute.+service_role/is);
    expect(migration).toMatch(/revoke all.+authenticated/is);
  });

  it("revalidates photos and mandate inside the transaction without requiring documents", () => {
    expect(migration).toContain("public.property_images");
    expect(migration).toContain("public.mandates");
    expect(migration).toContain("ownership_confirmed");
    expect(migration).toContain("mandate_accepted");
    expect(migration).not.toContain("property_documents");
  });

  it("supports reopened DRAFT resubmission without erasing rejection or decision history", () => {
    const update = migration.slice(migration.indexOf("update public.properties"), migration.indexOf("returning p.* into v_property") + 30);
    expect(update).toContain("marketplace_submitted_at = now()");
    expect(update).not.toMatch(/rejection_reason\s*=|marketplace_rejected_at\s*=|marketplace_reviewed_at\s*=/);
    expect(migration).not.toMatch(/delete from public\.marketplace_property_review_history/i);
  });

  it("casts legacy enum-backed property values before applying text functions", () => {
    expect(enumCastFix).toContain("create or replace function public.submit_marketplace_property_for_review");
    expect(enumCastFix).toContain("btrim(v_property.category::text)");
    expect(enumCastFix).toContain("btrim(v_property.property_type::text)");
    expect(enumCastFix).not.toMatch(/btrim\(v_property\.category\)(?!:)/);
    expect(enumCastFix).toMatch(/grant execute.+service_role/is);
    expect(enumCastFix).toMatch(/revoke all.+authenticated/is);
  });
});
