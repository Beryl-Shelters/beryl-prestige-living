import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const migration = readFileSync(path.resolve(__dirname, "../../../supabase/migrations/202608180002_marketplace_submit_for_review.sql"), "utf8");

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
});
