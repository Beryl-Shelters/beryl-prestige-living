import { NextResponse } from "next/server";
import { bodyOf, errorResponse, preAuthAnalyticsId, upstream } from "../_shared";
export async function POST(request: Request) { try { const { response, payload } = await upstream("admin/auth/login", await bodyOf(request), "POST", undefined, preAuthAnalyticsId(request)); return NextResponse.json(payload, { status: response.status }); } catch (error) { return errorResponse(error); } }
