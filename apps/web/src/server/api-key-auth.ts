import { NextRequest, NextResponse } from "next/server";
import {
  ApiAuthError,
  authenticateApiKey,
  extractApiKeyFromHeaders,
  type ApiKeyAuthContext,
} from "@neylonai/domain/billing";

export type { ApiKeyAuthContext };

function clientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}

/**
 * Require a valid client API key + eligible subscription.
 * Use on chatbot / orchestration routes.
 */
export async function requireApiKeyAuth(
  req: NextRequest,
): Promise<ApiKeyAuthContext | NextResponse> {
  try {
    return await authenticateApiKey({
      rawKey: extractApiKeyFromHeaders(req.headers),
      clientIp: clientIp(req),
      origin: req.headers.get("origin") ?? req.headers.get("referer"),
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
        },
        { status: error.status },
      );
    }
    console.error("[requireApiKeyAuth]", error);
    return NextResponse.json(
      { success: false, error: "Authorization failed", code: "invalid_api_key" },
      { status: 401 },
    );
  }
}

export function isApiKeyAuthContext(
  value: ApiKeyAuthContext | NextResponse,
): value is ApiKeyAuthContext {
  return !(value instanceof NextResponse) && "organizationId" in value;
}
