import { bodyOf, errorResponse, protectedAdminRequest } from "../../../../_shared";

export async function POST(request: Request, { params }: { params: Promise<{ propertyId: string }> }) {
  try { return await protectedAdminRequest(`admin/marketplace/properties/${encodeURIComponent((await params).propertyId)}/reject`, "POST", await bodyOf(request)); }
  catch (error) { return errorResponse(error); }
}
