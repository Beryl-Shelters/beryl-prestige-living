import { NextRequest, NextResponse } from "next/server";
import { bodyOf, errorResponse, upstream } from "../_shared";
export async function POST(request: NextRequest) { try { const { response, payload } = await upstream("admin/auth/resend-activation-otp", await bodyOf(request)); return NextResponse.json(payload, { status: response.status }); } catch (error) { return errorResponse(error); } }
