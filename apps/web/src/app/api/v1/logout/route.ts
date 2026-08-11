import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/server/auth-cookies";

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ success: true, data: null, error: null });
}
