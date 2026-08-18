import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
const sql = readFileSync(path.resolve(__dirname, "../../../supabase/migrations/202608180003_admin_marketplace_review.sql"), "utf8");
describe("Admin Marketplace atomic review migration", () => {
  it("records server lifecycle timestamps and an Admin reviewer", () => { for (const value of ["marketplace_reviewed_at timestamptz", "marketplace_published_at timestamptz", "marketplace_rejected_at timestamptz", "marketplace_reviewed_by_admin_id uuid references public.admins"]) expect(sql).toContain(value); });
  it("locks the property and permits only IN_REVIEW transitions", () => { expect(sql).toMatch(/where p\.id = p_property_id\s+for update/i); expect(sql).toContain("marketplace_status <> 'IN_REVIEW'"); expect(sql).toContain("'ALREADY_REVIEWED'"); expect(sql).toContain("'NOT_IN_REVIEW'"); });
  it("revalidates canonical completeness before LIVE", () => { for (const invariant of ["propertyCategory", "askingPrice", "v_photo_count < 1", "v_cover_count <> 1", "v_distinct_orders <> v_photo_count", "ownershipConfirmed", "mandateAccepted"]) expect(sql).toContain(invariant); });
  it("persists each decision and immutable history atomically", () => { expect(sql).toContain("marketplace_status = 'LIVE'"); expect(sql).toContain("marketplace_status = 'REJECTED'"); expect(sql.match(/insert into public\.marketplace_property_review_history/g)).toHaveLength(2); });
  it("restricts the security-definer RPC to service_role", () => { expect(sql).toContain("security definer"); expect(sql).toMatch(/revoke all on function .* from public, anon, authenticated/); expect(sql).toMatch(/grant execute on function .* to service_role/); });
});
