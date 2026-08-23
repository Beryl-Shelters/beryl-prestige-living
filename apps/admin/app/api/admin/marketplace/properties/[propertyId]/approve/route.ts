import { errorResponse, protectedAdminRequest } from "../../../../_shared";

export async function POST(_request: Request, { params }: { params: Promise<{ propertyId: string }> }) {
  try { return await protectedAdminRequest(`admin/marketplace/properties/${encodeURIComponent((await params).propertyId)}/approve`, "POST", {}); }
  catch (error) { return errorResponse(error); }
}
