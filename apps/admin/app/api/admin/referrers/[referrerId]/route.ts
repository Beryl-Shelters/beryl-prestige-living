import { errorResponse, protectedAdminRequest } from "../../_shared";

export async function GET(_request: Request, { params }: { params: Promise<{ referrerId: string }> }) {
  try { return await protectedAdminRequest(`admin/referrers/${encodeURIComponent((await params).referrerId)}`, "GET"); }
  catch (error) { return errorResponse(error); }
}
