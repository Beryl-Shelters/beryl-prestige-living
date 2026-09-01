import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminLeadDetailScreen } from "./admin-lead-detail";

const lead = {
  id: "11111111-1111-4111-8111-111111111111",
  referenceId: "ENQ-11111111",
  stage: "CONTACTED" as const,
  inquiryType: "MARKETPLACE_INTEREST_CALL",
  source: "REFERRAL" as const,
  receivedAt: "2026-08-22T10:00:00.000Z",
  updatedAt: "2026-08-22T10:00:00.000Z",
  customer: {
    id: "22222222-2222-4222-8222-222222222222",
    fullName: "Tomi Balogun",
    email: "tomi@example.com",
    phone: "+2348012345678",
    emailVerified: true,
    accountStatus: "ACTIVE",
    preferredContactMethod: "CALL" as const,
    personas: [{ type: "BUYER", onboardingStatus: "COMPLETED" }]
  },
  referredBy: { id: "33333333-3333-4333-8333-333333333333", fullName: "Emeka Chukwu" },
  message: "I would like to arrange a viewing.",
  property: null,
  history: []
};

const response = (data: unknown) => ({ ok: true, json: async () => ({ success: true, data }) });

describe("Admin Lead Won confirmation", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("shows Referral source and Referred by independently on a property-independent Lead", async () => {
    fetchMock.mockResolvedValueOnce(response({ lead }));
    render(<AdminLeadDetailScreen leadId={lead.id} />);
    expect(await screen.findByText("Referral")).toBeInTheDocument();
    expect(screen.getByText("Referred by")).toBeInTheDocument();
    expect(screen.getByText("Emeka Chukwu")).toBeInTheDocument();
    expect(screen.getByText("This enquiry is not linked to a property.")).toBeInTheDocument();
  });

  it("does not mutate on open or cancel, then confirms exactly once and refreshes", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ lead }))
      .mockResolvedValueOnce(response({ stage: "WON" }))
      .mockResolvedValueOnce(response({ lead: { ...lead, stage: "WON" } }));

    render(<AdminLeadDetailScreen leadId={lead.id} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mark as won" }));
    expect(screen.getByRole("dialog", { name: "Move this enquiry to a Won Lead?" })).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Mark as won" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
