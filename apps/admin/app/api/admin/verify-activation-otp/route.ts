import { NextRequest, NextResponse } from "next/server";
import { setSetupPasswordProof } from "@/lib/server/admin-cookies";
import { bodyOf, errorResponse, upstream } from "../_shared";
export async function POST(request: NextRequest) { try { const { response, payload } = await upstream("admin/auth/verify-activation-otp", await bodyOf(request)); if (!response.ok || !payload.data) return NextResponse.json(payload, { status: response.status }); const { setupToken, expiresIn, ...safeData } = payload.data as { setupToken: string; expiresIn: number } & Record<string, unknown>; const next = NextResponse.json({ ...payload, data: safeData }, { status: response.status }); setSetupPasswordProof(next, setupToken, expiresIn); return next; } catch (error) { return errorResponse(error); } }
