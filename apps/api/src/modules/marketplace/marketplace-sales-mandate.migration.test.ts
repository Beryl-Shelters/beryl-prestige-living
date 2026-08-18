import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(path.resolve(__dirname, "../../../supabase/migrations/202608180001_marketplace_sales_mandate.sql"), "utf8");

describe("Marketplace sales mandate migration", () => {
  it("extends the existing mandate domain additively", () => {
    expect(sql).toContain("alter table public.mandates");
    for (const column of ["marketplace_mandate_type", "ownership_confirmed", "mandate_accepted", "accepted_at", "agreement_version", "commission_percentage", "commission_amount"]) expect(sql).toContain(`add column if not exists ${column}`);
    expect(sql).not.toMatch(/create table/i);
    expect(sql).not.toMatch(/\bdrop\b/i);
  });

  it("enforces canonical ownership, accepted-state integrity, and one current mandate", () => {
    expect(sql).toContain("references public.properties(id)");
    expect(sql).toContain("marketplace_mandate_type in ('EXCLUSIVE', 'OPEN')");
    expect(sql).toContain("not mandate_accepted or (ownership_confirmed and accepted_at is not null)");
    expect(sql).toContain("create unique index if not exists mandates_marketplace_property_uidx");
    expect(sql).toContain("where marketplace_mandate_type is not null");
    expect(sql).toContain("enable row level security");
  });
});
