import { errorResponse, protectedAdminRequest } from "../../_shared";

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try { return await protectedAdminRequest(`admin/users/${encodeURIComponent((await params).userId)}`, "GET"); }
  catch (error) { return errorResponse(error); }
}
