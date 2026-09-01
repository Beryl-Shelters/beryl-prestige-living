import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminLeadsBoard } from "./admin-leads-board";

const fetchMock = vi.fn();
const response = (data: unknown) => ({ ok: true, json: async () => ({ success: true, data }) });
const referralLead = {
  id: "11111111-1111-4111-8111-111111111111",
  referenceId: "ENQ-11111111",
  customerName: "Ada Referral",
  propertyId: null,
  propertyTitle: null,
  propertyReferenceId: null,
  stage: "NEW" as const,
  inquiryType: "REFERRAL_BUYING_EMAIL",
  receivedAt: "2026-09-01T10:00:00.000Z",
  source: "REFERRAL" as const,
  referredBy: { id: "referrer-1", fullName: "Guest Referrer" }
};
const ordinaryLead = {
  ...referralLead,
  id: "22222222-2222-4222-8222-222222222222",
  referenceId: "ENQ-22222222",
  customerName: "Ordinary Buyer",
  inquiryType: "MARKETPLACE_INTEREST_CALL",
  source: null,
  referredBy: null
};

describe("Admin Leads referral source", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("renders one Referral badge and independent referrer text without tagging ordinary Leads", async () => {
    fetchMock.mockResolvedValue(response({
      counts: { NEW: 2, CONTACTED: 0, WON: 0, LOST: 0 },
      total: 2,
      items: [referralLead, ordinaryLead],
      perStageLimit: 20,
      query: null
    }));
    render(<AdminLeadsBoard />);
    expect(await screen.findByText("Ada Referral")).toBeInTheDocument();
    expect(screen.getAllByText("Referral")).toHaveLength(1);
    expect(screen.getByText("Referred by Guest Referrer")).toBeInTheDocument();
    expect(screen.getByText("Ordinary Buyer")).toBeInTheDocument();
  });
});
