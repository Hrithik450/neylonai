import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySession } from "@neylonai/auth/session";

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;

  const isDashboard = pathname.startsWith("/dashboard");
  const isAdmin = pathname.startsWith("/admin");

  if ((isDashboard || isAdmin) && !session) {
    const redirectUrl = new URL("/", request.url);
    redirectUrl.searchParams.set("auth", "false");
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isAdmin && session && session.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (session && searchParams.has("auth")) {
    const cleanUrl = new URL(request.url);
    cleanUrl.searchParams.delete("auth");
    return NextResponse.redirect(cleanUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|orchestration|_next/static|_next/image|favicon.ico|fonts|sounds|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|wav|ogg|ico|woff2)$).*)",
  ],
};
