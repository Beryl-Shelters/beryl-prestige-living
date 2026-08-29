import { beforeEach, describe, expect, it, vi } from "vitest";

type DbResult = { data: unknown; error: unknown };
const state = vi.hoisted(() => ({ queues: new Map<string, DbResult[]>(), rpc: [] as DbResult[], uploaded: vi.fn(), deleted: vi.fn() }));
const query = (table: string) => {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order"]) builder[method] = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(() => Promise.resolve(state.queues.get(table)?.shift() ?? { data: null, error: null }));
  Object.assign(builder, { then: (resolve: (value: DbResult) => unknown) => Promise.resolve(state.queues.get(table)?.shift() ?? { data: [], error: null }).then(resolve) });
  return builder;
};
vi.mock("../../config/supabase", () => ({ supabaseAdmin: { from: (table: string) => query(table), rpc: () => Promise.resolve(state.rpc.shift() ?? { data: null, error: null }) } }));
vi.mock("../../utils/cloudinary", () => ({ uploadReferralPaymentReceipt: (...args: unknown[]) => state.uploaded(...args), deleteReferralPaymentReceipt: (...args: unknown[]) => state.deleted(...args), createReferralPaymentReceiptAccessUrl: vi.fn() }));
import { markReferralPaid } from "./admin-referrers.service";

const referrer = { id: "referrer-1", customer_user_id: null, full_name: "Ada Referrer", phone_e164: "+2348012345678", referral_code: "ADA-ONE", created_at: "2026-08-29" };
const referral = { id: "referral-1", referrer_identity_id: "referrer-1", reference_id: "REF-2608-0001", referred_full_name: "Buyer One", lifecycle_status: "COMPLETED", reward_amount: 50000, payment_status: "OUTSTANDING" };
const payout = { bank_name: "Access Bank", account_name: "Ada Referrer", account_number_last4: "1234" };
const file = (buffer: Buffer, mimetype = "application/pdf") => ({ buffer, mimetype, originalname: "receipt.pdf", size: buffer.length } as Express.Multer.File);
const prime = () => { state.queues.set("referrers", [{ data: referrer, error: null }]); state.queues.set("referrals", [{ data: referral, error: null }]); state.queues.set("referrer_payout_details", [{ data: payout, error: null }]); };

describe("Admin referral payment service", () => {
  beforeEach(() => { state.queues.clear(); state.rpc.length = 0; state.uploaded.mockReset(); state.deleted.mockReset(); state.uploaded.mockResolvedValue({ public_id: "private/receipt-1" }); state.deleted.mockResolvedValue("deleted"); });
  it("rejects MIME spoofing before upload or database access", async () => {
    await expect(markReferralPaid("referrer-1", "referral-1", "admin-1", file(Buffer.from("not a pdf")))).rejects.toMatchObject({ code: "PAYMENT_RECEIPT_INVALID" });
    expect(state.uploaded).not.toHaveBeenCalled();
  });
  it("records only the server RPC result and authenticated Admin identity", async () => {
    prime(); state.rpc.push({ data: [{ outcome: "PAID", payment_id: "payment-1", referral_id: "referral-1", referrer_id: "referrer-1", reference_id: "REF-2608-0001", amount: 50000, payment_status: "PAID", paid_at: "2026-08-29T10:00:00Z", recorded_by_admin_id: "admin-1" }], error: null });
    await expect(markReferralPaid("referrer-1", "referral-1", "admin-1", file(Buffer.from("%PDF-1.7 safe")))).resolves.toMatchObject({ payment: { amount: 50000, status: "PAID", recordedByAdminId: "admin-1" } });
    expect(state.uploaded).toHaveBeenCalledOnce(); expect(state.deleted).not.toHaveBeenCalled();
  });
  it("maps an atomic duplicate to REFERRAL_ALREADY_PAID and removes the orphan upload", async () => {
    prime(); state.rpc.push({ data: [{ outcome: "ALREADY_PAID" }], error: null });
    await expect(markReferralPaid("referrer-1", "referral-1", "admin-1", file(Buffer.from("%PDF-1.7 safe")))).rejects.toMatchObject({ code: "REFERRAL_ALREADY_PAID" });
    expect(state.deleted).toHaveBeenCalledWith("private/receipt-1");
  });
  it("removes the private upload when the atomic RPC is unavailable", async () => {
    prime(); state.rpc.push({ data: null, error: { message: "private database error" } });
    await expect(markReferralPaid("referrer-1", "referral-1", "admin-1", file(Buffer.from("%PDF-1.7 safe")))).rejects.toMatchObject({ code: "REFERRAL_PAYMENT_FAILED", statusCode: 503 });
    expect(state.deleted).toHaveBeenCalledWith("private/receipt-1");
  });
  it("does not upload when the canonical referral is not payable", async () => {
    state.queues.set("referrers", [{ data: referrer, error: null }]); state.queues.set("referrals", [{ data: { ...referral, lifecycle_status: "CONTACTED", payment_status: "NOT_ELIGIBLE" }, error: null }]); state.queues.set("referrer_payout_details", [{ data: payout, error: null }]);
    await expect(markReferralPaid("referrer-1", "referral-1", "admin-1", file(Buffer.from("%PDF-1.7 safe")))).rejects.toMatchObject({ code: "REFERRAL_NOT_PAYABLE" });
    expect(state.uploaded).not.toHaveBeenCalled();
  });
});
