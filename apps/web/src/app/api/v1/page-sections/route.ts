import { NextRequest, NextResponse } from "next/server";
import { listKnowledgePageSectionKeys } from "@neylonai/database";
import { listAllowedSourceIds } from "@neylonai/domain/knowledge";
import {
  isApiKeyAuthContext,
  requireApiKeyAuth,
} from "@/server/api-key-auth";

/**
 * Path-scoped section keys for SDK codegen.
 * Publishable API key auth — returns keys only, never section content.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiKeyAuth(req);
    if (!isApiKeyAuthContext(auth)) return auth;

    const sourceIds = await listAllowedSourceIds(
      auth.organizationId,
      "main-agent",
    );
    const pages = await listKnowledgePageSectionKeys({
      organizationId: auth.organizationId,
      sourceIds,
    });

    return NextResponse.json(
      {
        success: true,
        data: { pages },
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
          error instanceof Error
            ? error.message
            : "Failed to load section keys",
      },
      { status: 500 },
    );
  }
}
