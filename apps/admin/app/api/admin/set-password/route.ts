import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIES } from "@/lib/server/admin-cookies";
import { bodyOf, errorResponse, upstream } from "../_shared";
export async function POST(request: NextRequest) { try { const setupToken = (await cookies()).get(ADMIN_COOKIES.setupPassword)?.value; if (!setupToken) return NextResponse.json({ success: false, message: "Your activation session has expired. Open your invitation again.", code: "INVALID_ADMIN_SETUP_TOKEN" }, { status: 401 }); const { response, payload } = await upstream("admin/auth/set-password", { ...(await bodyOf(request)), setupToken }); const next = NextResponse.json(payload, { status: response.status }); if (response.ok) next.cookies.delete(ADMIN_COOKIES.setupPassword); return next; } catch (error) { return errorResponse(error); } }
