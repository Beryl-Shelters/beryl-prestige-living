import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIES } from "@/lib/server/admin-cookies";
export async function GET() { const jar = await cookies(); const state = jar.get(ADMIN_COOKIES.state)?.value; if (!jar.get(ADMIN_COOKIES.access)?.value || !state || jar.get(ADMIN_COOKIES.changePassword)?.value) return NextResponse.json({ success: false, message: "Session not found", code: "SESSION_NOT_FOUND" }, { status: 401 }); try { return NextResponse.json({ success: true, message: "Session restored", data: JSON.parse(state) }); } catch { return NextResponse.json({ success: false, message: "Session not found", code: "SESSION_NOT_FOUND" }, { status: 401 }); } }
