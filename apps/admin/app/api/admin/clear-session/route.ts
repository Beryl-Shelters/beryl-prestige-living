import { NextResponse } from "next/server";
import { clearAdminCookies } from "@/lib/server/admin-cookies";
export async function POST() { const response = NextResponse.json({ success: true, message: "Local Admin session cleared.", data: { cleared: true } }); clearAdminCookies(response); return response; }
