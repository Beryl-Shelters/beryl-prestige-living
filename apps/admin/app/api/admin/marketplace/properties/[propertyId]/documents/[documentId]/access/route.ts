import { errorResponse, protectedAdminRequest } from "../../../../../../_shared";

export async function GET(_request: Request, { params }: { params: Promise<{ propertyId: string; documentId: string }> }) {
  try {
    const { propertyId, documentId } = await params;
    return await protectedAdminRequest(`admin/marketplace/properties/${encodeURIComponent(propertyId)}/documents/${encodeURIComponent(documentId)}/access`, "GET");
  } catch (error) { return errorResponse(error); }
}
