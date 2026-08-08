import { NextRequest } from "next/server";
import { bodyOf, errorResponse, protectedAdminRequest } from "../_shared";
export async function POST(request: NextRequest) { try { return await protectedAdminRequest("admin/staff/invite", "POST", await bodyOf(request)); } catch (error) { return errorResponse(error); } }
