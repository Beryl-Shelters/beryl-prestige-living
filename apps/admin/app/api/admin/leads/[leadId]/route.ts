import { errorResponse, protectedAdminRequest } from "../../_shared";

export async function GET(_request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  try { return await protectedAdminRequest(`admin/leads/${encodeURIComponent((await params).leadId)}`, "GET"); }
  catch (error) { return errorResponse(error); }
}
