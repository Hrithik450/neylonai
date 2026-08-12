import { NextRequest, NextResponse } from "next/server";
import {
  isApiKeyAuthContext,
  requireApiKeyAuth,
} from "@/server/api-key-auth";
import { getWidgetConfigForOrg } from "@/server/widget-config";

/**
 * Public branding for an embed installation.
 * Requires client API key — never returns secrets.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiKeyAuth(req);
    if (!isApiKeyAuthContext(auth)) return auth;

    const config = await getWidgetConfigForOrg(auth.organizationId);
    return NextResponse.json(
      {
        success: true,
        data: config,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load widget config",
      },
      { status: 500 },
    );
  }
}
