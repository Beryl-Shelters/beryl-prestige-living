import { NextRequest } from "next/server";
import { clearAdminCookies } from "@/lib/server/admin-cookies";
import { bodyOf, errorResponse, protectedAdminRequest } from "../_shared";
export async function PATCH(request: NextRequest) { try { const response = await protectedAdminRequest("admin/auth/change-password", "PATCH", await bodyOf(request)); if (response.ok) clearAdminCookies(response); return response; } catch (error) { return errorResponse(error); } }
