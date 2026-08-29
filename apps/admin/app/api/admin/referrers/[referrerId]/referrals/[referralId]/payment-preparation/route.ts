import { errorResponse, protectedAdminRequest } from "../../../../../_shared";

export async function GET(_request: Request, { params }: { params: Promise<{ referrerId: string; referralId: string }> }) {
  try { const value = await params; const response = await protectedAdminRequest(`admin/referrers/${encodeURIComponent(value.referrerId)}/referrals/${encodeURIComponent(value.referralId)}/payment-preparation`, "GET"); response.headers.set("Cache-Control", "no-store, private"); return response; }
  catch (error) { return errorResponse(error); }
}
