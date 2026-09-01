import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../config/supabase", () => ({ supabaseAdmin: { rpc } }));

import { listLeads } from "./admin-leads.service";

const base = {
  lead_id: "11111111-1111-4111-8111-111111111111",
  reference_id: "ENQ-11111111",
  customer_name: "Ada Lead",
  property_id: null,
  property_title: null,
  property_reference_id: null,
  stage: "NEW",
  inquiry_type: "REFERRAL_BUYING_EMAIL",
  received_at: "2026-09-01T10:00:00.000Z",
  stage_total: 1
};

describe("Admin referral Lead list mapping", () => {
  beforeEach(() => rpc.mockReset());

  it("returns REFERRAL source and bounded referrer identity", async () => {
    rpc.mockResolvedValue({ data: [{ ...base, lead_source: "REFERRAL", referrer_id: "referrer-1", referrer_full_name: "Guest Referrer" }], error: null });
    await expect(listLeads({ q: "Ada", limit: 20 })).resolves.toMatchObject({
      items: [{ source: "REFERRAL", referredBy: { id: "referrer-1", fullName: "Guest Referrer" }, stage: "NEW" }],
      counts: { NEW: 1 }
    });
    expect(rpc).toHaveBeenCalledWith("list_admin_inquiry_leads", { p_query: "Ada", p_per_stage_limit: 20 });
  });

  it("does not falsely label an ordinary Lead as Referral", async () => {
    rpc.mockResolvedValue({ data: [{ ...base, inquiry_type: "MARKETPLACE_INTEREST_CALL", lead_source: null, referrer_id: null, referrer_full_name: null }], error: null });
    await expect(listLeads({ limit: 20 })).resolves.toMatchObject({ items: [{ source: null, referredBy: null }] });
  });
});
