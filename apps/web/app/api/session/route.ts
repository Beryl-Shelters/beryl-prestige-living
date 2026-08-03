import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIES } from "@/lib/server/session-cookies";

export const GET = async () => {
  const cookieStore = await cookies();
  const state = cookieStore.get(SESSION_COOKIES.state)?.value;
  const access = cookieStore.get(SESSION_COOKIES.access)?.value;
  if (!state || !access) {
    return NextResponse.json({ success: false, message: "Session not found", code: "SESSION_NOT_FOUND" }, { status: 401 });
  }
  try {
    return NextResponse.json({ success: true, message: "Session restored", data: JSON.parse(state) });
  } catch {
    return NextResponse.json({ success: false, message: "Session not found", code: "SESSION_NOT_FOUND" }, { status: 401 });
  }
};
