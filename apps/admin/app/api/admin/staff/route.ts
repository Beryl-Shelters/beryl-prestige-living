import { errorResponse, protectedAdminRequest } from "../_shared";
export async function GET() { try { return await protectedAdminRequest("admin/staff", "GET"); } catch (error) { return errorResponse(error); } }
