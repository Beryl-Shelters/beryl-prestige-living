import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(path.resolve(__dirname, "../../../supabase/migrations/202608230001_marketplace_delete_draft.sql"), "utf8");
const documents = readFileSync(path.resolve(__dirname, "../../../supabase/migrations/202608170001_property_documents_foundation.sql"), "utf8");
const mandate = readFileSync(path.resolve(__dirname, "../../../supabase/migrations/202608180001_marketplace_sales_mandate.sql"), "utf8");
const review = readFileSync(path.resolve(__dirname, "../../../supabase/migrations/202608180003_admin_marketplace_review.sql"), "utf8");

describe("Marketplace DRAFT delete migration", () => {
  it("locks owner state and atomically deletes only DRAFT", () => {
    expect(migration).toContain("for update");
    expect(migration).toContain("p.owner_id = p_owner_id");
    expect(migration).toContain("v_property.marketplace_status <> 'DRAFT'");
    expect(migration).toContain("and p.marketplace_status = 'DRAFT'");
    for (const outcome of ["NOT_FOUND", "NOT_EDITABLE", "DELETED"]) expect(migration).toContain(`'${outcome}'`);
  });
  it("is service-role only and preserves known canonical cascades", () => {
    expect(migration).toMatch(/revoke all[\s\S]*from public, anon, authenticated/i);
    expect(migration).toMatch(/grant execute[\s\S]*to service_role/i);
    expect(documents).toMatch(/property_id uuid not null references public\.properties\(id\) on delete cascade/i);
    expect(mandate).toMatch(/foreign key \(property_id\) references public\.properties\(id\) on delete cascade/i);
    expect(review).toMatch(/property_id uuid not null references public\.properties\(id\) on delete cascade/i);
    expect(migration).not.toMatch(/drop table|truncate/i);
  });
});
