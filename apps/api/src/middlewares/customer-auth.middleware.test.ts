import { beforeEach, describe, expect, it, vi } from "vitest";

const profileSingle = vi.hoisted(() => vi.fn());
const customerSingle = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() =>
  vi.fn((table: string) => ({
    select: () => ({
      eq: () => ({
        maybeSingle: table === "profiles" ? profileSingle : customerSingle
      })
    })
  }))
);

vi.mock("../config/supabase", () => ({ supabaseAdmin: { from } }));

import { requireVerifiedCustomer } from "./customer-auth.middleware";

const run = async (user?: { id: string }) => {
  const next = vi.fn();
  await requireVerifiedCustomer(
    { user } as any,
    {} as any,
    next
  );
  return next;
};

describe("verified customer authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    customerSingle.mockResolvedValue({ data: { id: "record-id" }, error: null });
  });

  it("rejects unauthenticated access", async () => {
    const next = await run();
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects an unverified customer with a stable code", async () => {
    profileSingle.mockResolvedValue({
      data: {
        account_status: "PENDING_VERIFICATION",
        email_verified_at: null,
        role: null
      },
      error: null
    });

    const next = await run({ id: "customer-id" });
    expect(next.mock.calls[0][0]).toMatchObject({
      statusCode: 403,
      code: "ACCOUNT_VERIFICATION_REQUIRED"
    });
  });

  it("rejects a legacy Admin token on customer routes", async () => {
    profileSingle.mockResolvedValue({
      data: {
        account_status: "ACTIVE",
        email_verified_at: "2026-08-03T00:00:00.000Z",
        role: "admin"
      },
      error: null
    });

    const next = await run({ id: "admin-id" });
    expect(next.mock.calls[0][0]).toMatchObject({
      statusCode: 403,
      code: "CUSTOMER_ACCESS_REQUIRED"
    });
  });

  it("allows only an active verified customer with one projection record", async () => {
    profileSingle.mockResolvedValue({
      data: {
        account_status: "ACTIVE",
        email_verified_at: "2026-08-03T00:00:00.000Z",
        role: null
      },
      error: null
    });

    const next = await run({ id: "customer-id" });
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });
});
