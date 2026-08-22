import { errorResponse, protectedAdminRequest } from "../../../_shared";

export async function GET(_request: Request, { params }: { params: Promise<{ propertyId: string }> }) {
  try { return await protectedAdminRequest(`admin/marketplace/properties/${encodeURIComponent((await params).propertyId)}`, "GET"); }
  catch (error) { return errorResponse(error); }
}
