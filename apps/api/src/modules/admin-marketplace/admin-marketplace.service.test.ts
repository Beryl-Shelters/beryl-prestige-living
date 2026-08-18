import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data?: any; error?: unknown };
const database = vi.hoisted(() => ({ rpcResponses: [] as Result[], calls: [] as Array<{ name: string; args: any }> }));
vi.mock("../../config/supabase", () => ({ supabaseAdmin: { rpc: (name: string, args: any) => { database.calls.push({ name, args }); return Promise.resolve(database.rpcResponses.shift() ?? { data: null, error: null }); }, from: vi.fn() } }));
vi.mock("../../utils/cloudinary", () => ({ createPropertyDocumentAccessUrl: vi.fn(() => "https://signed.example/document") }));
import { reviewProperty } from "./admin-marketplace.service";

const approved = { outcome: "APPROVED", property_id: "property-1", reference_id: "BRL-ONE", marketplace_status: "LIVE", reviewed_at: "2026-08-18T14:00:00.000Z", published_at: "2026-08-18T14:00:00.000Z", rejected_at: null, rejection_reason: null, missing_fields: [] };
const rejected = { outcome: "REJECTED", property_id: "property-1", reference_id: "BRL-ONE", marketplace_status: "REJECTED", reviewed_at: "2026-08-18T14:00:00.000Z", published_at: null, rejected_at: "2026-08-18T14:00:00.000Z", rejection_reason: "Provide a clearer survey plan", missing_fields: [] };

describe("Admin Marketplace review decisions", () => {
  beforeEach(() => { database.rpcResponses.length = 0; database.calls.length = 0; });
  it("approves through one atomic RPC using the authenticated Admin ID", async () => { database.rpcResponses.push({ data: [approved], error: null }); await expect(reviewProperty("property-1", "admin-1", "APPROVE")).resolves.toEqual(expect.objectContaining({ status: "LIVE", reviewedAt: approved.reviewed_at, publishedAt: approved.published_at, nextAction: "VIEW_LIVE_LISTING" })); expect(database.calls).toEqual([{ name: "review_marketplace_property", args: { p_property_id: "property-1", p_admin_id: "admin-1", p_action: "APPROVE", p_reason: null } }]); });
  it("rejects with Seller-safe feedback through the same atomic RPC", async () => { database.rpcResponses.push({ data: [rejected], error: null }); await expect(reviewProperty("property-1", "admin-2", "REJECT", rejected.rejection_reason)).resolves.toEqual(expect.objectContaining({ status: "REJECTED", rejectedAt: rejected.rejected_at, rejectionReason: rejected.rejection_reason, nextAction: "VIEW_REJECTION" })); expect(database.calls[0].args.p_admin_id).toBe("admin-2"); });
  it.each([["NOT_IN_REVIEW", "LISTING_NOT_IN_REVIEW"], ["ALREADY_REVIEWED", "LISTING_ALREADY_REVIEWED"], ["INVALID_REASON", "REJECTION_REASON_INVALID"]])("maps %s without retrying or creating duplicate decisions", async (outcome, code) => { database.rpcResponses.push({ data: [{ ...approved, outcome }], error: null }); await expect(reviewProperty("property-1", "admin-1", "APPROVE")).rejects.toMatchObject({ code }); expect(database.calls).toHaveLength(1); });
  it("returns missing fields when atomic approval revalidation fails", async () => { database.rpcResponses.push({ data: [{ ...approved, outcome: "INCOMPLETE", missing_fields: ["coverImage"] }], error: null }); await expect(reviewProperty("property-1", "admin-1", "APPROVE")).rejects.toMatchObject({ code: "LISTING_APPROVAL_FAILED", details: { missingFields: ["coverImage"] } }); });
  it("does not expose database errors", async () => { database.rpcResponses.push({ data: null, error: { message: "private database detail" } }); await expect(reviewProperty("property-1", "admin-1", "REJECT", "Needs changes")).rejects.toMatchObject({ statusCode: 503, code: "LISTING_REJECTION_FAILED", message: "Listing rejection failed" }); });
});
