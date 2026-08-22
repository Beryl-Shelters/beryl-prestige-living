import { bodyOf, errorResponse, protectedAdminRequest } from "../../../_shared";

export async function PATCH(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  try { return await protectedAdminRequest(`admin/leads/${encodeURIComponent((await params).leadId)}/stage`, "PATCH", await bodyOf(request)); }
  catch (error) { return errorResponse(error); }
}
