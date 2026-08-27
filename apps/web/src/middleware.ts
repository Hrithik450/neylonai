import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySession } from "@neylonai/auth/session";

/**
 * CORS for the embeddable widget's cross-origin API calls. The widget runs on
 * customer domains and authenticates with a public API key sent as a Bearer
 * token (never cookies), so every widget request is cross-origin and
 * un-credentialed — a wildcard origin is safe. `Authorization` must be listed
 * explicitly; the `*` wildcard never covers it.
 *
 * Per-key domain restriction (the `allowed_domains` field on api_keys) is
 * enforced server-side in `authenticateApiKey`, which rejects disallowed
 * Origins with a 403. It deliberately does NOT live here: middleware runs on
 * the edge with no DB access, so it can't look a key's allowlist up. Keeping
 * CORS wildcard lets the browser reach the auth layer, read that 403, and
 * surface a clear "domain not allowed" error.
 */
const WIDGET_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

/** Paths served cross-origin to the embedded widget (API-key auth, not cookies). */
function isPublicApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/") || pathname.startsWith("/orchestration/");
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Widget API calls come from customer domains. Answer preflight and attach
  // CORS headers to every response (success, error, and streaming) before any
  // session logic — these routes never rely on the session cookie.
  if (isPublicApiPath(pathname)) {
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: WIDGET_CORS_HEADERS,
      });
    }
    const response = NextResponse.next();
    for (const [key, value] of Object.entries(WIDGET_CORS_HEADERS)) {
      response.headers.set(key, value);
    }
    return response;
  }

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
    "/((?!_next/static|_next/image|favicon.ico|fonts|sounds|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|wav|ogg|ico|woff2)$).*)",
  ],
};
