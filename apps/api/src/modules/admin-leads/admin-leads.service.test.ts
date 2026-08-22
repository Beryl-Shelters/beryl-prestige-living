import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data?: any; error?: unknown };
const database = vi.hoisted(() => ({ responses: [] as Result[], calls: [] as Array<{ name: string; args: any }> }));
vi.mock("../../config/supabase", () => ({ supabaseAdmin: {
  rpc: (name: string, args: any) => { database.calls.push({ name, args }); return Promise.resolve(database.responses.shift() ?? { data: null, error: null }); },
  from: vi.fn()
} }));

import { listLeads, updateLeadStage } from "./admin-leads.service";

describe("Admin lead list and transitions", () => {
  beforeEach(() => { database.responses.length = 0; database.calls.length = 0; });

  it("returns database-authoritative stage counts and bounded cards", async () => {
    database.responses.push({ data: [
      { lead_id: "lead-1", reference_id: "ENQ-ONE", customer_name: "Ngozi Umeh", property_id: "property-1", property_title: "3 Bedroom Flat", property_reference_id: "BRL-1", stage: "NEW", inquiry_type: "MARKETPLACE_INTEREST_CALL", received_at: "2026-08-22T12:00:00Z", stage_total: 18 },
      { lead_id: "lead-2", reference_id: "ENQ-TWO", customer_name: "Ada Obi", property_id: "property-2", property_title: "Terrace", property_reference_id: "BRL-2", stage: "CONTACTED", inquiry_type: "MARKETPLACE_INTEREST_EMAIL", received_at: "2026-08-22T11:00:00Z", stage_total: 7 }
    ], error: null });
    await expect(listLeads({ q: "BRL", limit: 12 })).resolves.toMatchObject({ counts: { NEW: 18, CONTACTED: 7, WON: 0, LOST: 0 }, perStageLimit: 12, query: "BRL" });
    expect(database.calls).toEqual([{ name: "list_admin_inquiry_leads", args: { p_query: "BRL", p_per_stage_limit: 12 } }]);
  });

  it("maps list persistence failures to a stable safe error", async () => {
    database.responses.push({ data: null, error: { message: "private database detail" } });
    await expect(listLeads({ limit: 20 })).rejects.toMatchObject({ statusCode: 503, code: "LEADS_UNAVAILABLE", message: "Lead management is temporarily unavailable" });
  });

  it("transitions through the atomic RPC using the authenticated Admin", async () => {
    database.responses.push({ data: [{ outcome: "UPDATED", inquiry_id: "lead-1", previous_stage: "NEW", current_stage: "CONTACTED", changed_at: "2026-08-22T12:00:00Z" }], error: null });
    await expect(updateLeadStage("lead-1", "admin-1", "NEW", "CONTACTED")).resolves.toMatchObject({ leadId: "lead-1", previousStage: "NEW", stage: "CONTACTED" });
    expect(database.calls[0]).toEqual({ name: "transition_admin_inquiry_lead_stage", args: { p_inquiry_id: "lead-1", p_admin_id: "admin-1", p_expected_stage: "NEW", p_new_stage: "CONTACTED" } });
  });

  it.each([
    ["CONTACTED", "WON"],
    ["CONTACTED", "LOST"]
  ] as const)("keeps the atomic %s to %s transition", async (previousStage, stage) => {
    database.responses.push({ data: [{ outcome: "UPDATED", inquiry_id: "lead-1", previous_stage: previousStage, current_stage: stage, changed_at: "2026-08-22T12:00:00Z" }], error: null });
    await expect(updateLeadStage("lead-1", "admin-1", previousStage, stage)).resolves.toMatchObject({ leadId: "lead-1", previousStage, stage });
    expect(database.calls[0]).toEqual({ name: "transition_admin_inquiry_lead_stage", args: { p_inquiry_id: "lead-1", p_admin_id: "admin-1", p_expected_stage: previousStage, p_new_stage: stage } });
  });

  it.each([
    ["NOT_FOUND", "LEAD_NOT_FOUND", 404],
    ["STALE", "LEAD_STAGE_CONFLICT", 409],
    ["INVALID_TRANSITION", "INVALID_LEAD_TRANSITION", 409]
  ])("maps %s without retrying", async (outcome, code, statusCode) => {
    database.responses.push({ data: [{ outcome, current_stage: "CONTACTED" }], error: null });
    await expect(updateLeadStage("lead-1", "admin-1", "NEW", "WON")).rejects.toMatchObject({ code, statusCode });
    expect(database.calls).toHaveLength(1);
  });
});
