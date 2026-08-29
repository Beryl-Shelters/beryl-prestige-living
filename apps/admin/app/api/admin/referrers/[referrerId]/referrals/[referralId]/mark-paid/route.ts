import { errorResponse, protectedAdminMultipartRequest } from "../../../../../_shared";

export async function POST(request: Request, { params }: { params: Promise<{ referrerId: string; referralId: string }> }) {
  try { const value = await params; return await protectedAdminMultipartRequest(`admin/referrers/${encodeURIComponent(value.referrerId)}/referrals/${encodeURIComponent(value.referralId)}/mark-paid`, request); }
  catch (error) { return errorResponse(error); }
}
