import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  buildProactiveSuggestions,
  runWithAgentTurnContext,
} from "@neylonai/agent";
import {
  ApiAuthError,
  assertCanUseProactive,
  recordProductUsageSafe,
} from "@neylonai/domain/billing";
import { resolveKnowledgeScope } from "@neylonai/database";
import { trackEventlySafe } from "@neylonai/integrations/evently";
import {
  isApiKeyAuthContext,
  requireApiKeyAuth,
} from "@/server/api-key-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiKeyAuth(req);
    if (!isApiKeyAuthContext(auth)) return auth;

    await assertCanUseProactive({
      organizationId: auth.organizationId,
      plan: auth.plan,
    });

    const scope = await resolveKnowledgeScope({
      organizationId: auth.organizationId,
    });
    if (!scope) {
      return NextResponse.json(
        {
          success: false,
          error: "Organization knowledge is not available",
          data: [],
        },
        { status: 404 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      pagePath?: string;
      pageUrl?: string;
      recentMessages?: Array<{ role: string; content: string }>;
      mode?: "idle" | "post_chat";
      limit?: number;
      visitorId?: string;
      sessionId?: string;
      excludeIds?: string[];
    };

    const visitorId =
      typeof body.visitorId === "string" ? body.visitorId.slice(0, 128) : null;
    const sessionId =
      typeof body.sessionId === "string" ? body.sessionId.slice(0, 128) : null;
    const excludeIds = Array.isArray(body.excludeIds)
      ? body.excludeIds
          .filter((id): id is string => typeof id === "string")
          .map((id) => id.slice(0, 64))
          .slice(0, 40)
      : [];

    const requestId = randomUUID();

    const suggestions = await runWithAgentTurnContext(
      {
        organizationId: scope.organizationId,
        requestId,
        apiKeyId: auth.apiKeyId ?? undefined,
      },
      () =>
        buildProactiveSuggestions({
          organizationId: scope.organizationId,
          pagePath: body.pagePath ?? null,
          pageUrl: body.pageUrl ?? null,
          recentMessages: Array.isArray(body.recentMessages)
            ? body.recentMessages.slice(-10).map((m) => ({
                role: String(m.role ?? "user"),
                content: String(m.content ?? "").slice(0, 500),
              }))
            : [],
          mode: body.mode === "post_chat" ? "post_chat" : "idle",
          limit: body.limit,
          visitorId,
          sessionId,
          excludeIds,
        }),
    );

    recordProductUsageSafe({
      organizationId: auth.organizationId,
      apiKeyId: auth.apiKeyId,
      metric: "proactive_refresh",
      requestId,
      metadata: {
        count: suggestions.length,
        mode: body.mode ?? "idle",
      },
    });

    // Evently records impressions only — never used as suggestion source of truth.
    for (const s of suggestions) {
      trackEventlySafe({
        event: "suggestion_shown",
        organizationId: auth.organizationId,
        pagePath: body.pagePath ?? null,
        suggestionId: s.id,
        visitorId,
        sessionId,
        properties: { source: s.source, mode: body.mode ?? "idle" },
      });
    }

    return NextResponse.json({ success: true, data: suggestions });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
          data: [],
        },
        { status: error.status },
      );
    }
    console.error("suggestions error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to build suggestions",
        data: [],
      },
      { status: 500 },
    );
  }
}
