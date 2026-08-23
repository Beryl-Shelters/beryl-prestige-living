import { NextRequest } from "next/server";
import { errorResponse, protectedAdminRequest } from "../../_shared";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.toString();
    return await protectedAdminRequest(`admin/marketplace/properties${query ? `?${query}` : ""}`, "GET");
  } catch (error) { return errorResponse(error); }
}
