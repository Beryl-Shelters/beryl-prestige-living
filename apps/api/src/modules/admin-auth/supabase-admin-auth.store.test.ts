import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("../../config/supabase", () => ({ supabaseAdmin: database }));

import { SupabaseAdminAuthStore } from "./supabase-admin-auth.store";

describe("SupabaseAdminAuthStore", () => {
  beforeEach(() => vi.clearAllMocks());

  it("selects the invited admin through the unambiguous admin_id relationship", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    database.from.mockReturnValue({ select });

    await new SupabaseAdminAuthStore().findInvitationByTokenHash("safe-test-hash");

    expect(database.from).toHaveBeenCalledWith("admin_invitations");
    expect(select).toHaveBeenCalledWith("*, admin:admins!admin_invitations_admin_id_fkey(*)");
  });
});
