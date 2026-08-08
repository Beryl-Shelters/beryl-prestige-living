import { NextRequest } from "next/server";
import { errorResponse, protectedAdminRequest } from "../../../_shared";
export async function POST(_request: NextRequest, { params }: { params: Promise<{ adminId: string }> }) { try { return await protectedAdminRequest(`admin/staff/${(await params).adminId}/resend-invitation`, "POST", {}); } catch (error) { return errorResponse(error); } }
