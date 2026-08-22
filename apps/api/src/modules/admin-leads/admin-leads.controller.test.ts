import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({ getLeadDetail: vi.fn(), updateLeadStage: vi.fn(), listLeads: vi.fn() }));
vi.mock("./admin-leads.service", () => service);

import { detail } from "./admin-leads.controller";

describe("Admin lead detail controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts and forwards a canonical inquiry UUID", async () => {
    const leadId = "11111111-1111-4111-8111-111111111111";
    service.getLeadDetail.mockResolvedValue({ id: leadId });
    const json = vi.fn();
    const next = vi.fn();
    await detail({ params: { leadId } } as any, { json } as any, next);
    expect(service.getLeadDetail).toHaveBeenCalledWith(leadId);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: { lead: { id: leadId } } }));
    expect(next).not.toHaveBeenCalled();
  });

  it("classifies a malformed identifier as LEAD_NOT_FOUND without querying Supabase", async () => {
    const next = vi.fn();
    await detail({ params: { leadId: "ENQ-11111111" } } as any, { json: vi.fn() } as any, next);
    expect(service.getLeadDetail).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404, code: "LEAD_NOT_FOUND" }));
  });
});
