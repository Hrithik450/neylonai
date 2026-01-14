import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  const sessionCookie =
    request.cookies.get("__Secure-authjs.session-token") ??
    request.cookies.get("authjs.session-token");

  if (!sessionCookie?.value && pathname !== "/") {
    const redirectUrl = new URL("/", request.url);

    if (!searchParams.has("auth")) {
      redirectUrl.searchParams.set("auth", "false");
    }

    return NextResponse.redirect(redirectUrl);
  }

  if (sessionCookie?.value && searchParams.has("auth")) {
    const cleanUrl = new URL(request.url);
    cleanUrl.searchParams.delete("auth");
    return NextResponse.redirect(cleanUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
