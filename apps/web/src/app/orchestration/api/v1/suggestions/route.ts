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
import {
  isApiKeyAuthContext,
  requireApiKeyAuth,
} from "@/server/api-key-auth";

export const dynamic = "force-dynamic";

function normalizePagePath(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = new URL(value.trim(), "https://widget.invalid");
    return (
      `/${parsed.pathname
        .split("/")
        .filter(Boolean)
        .map((part) => encodeURIComponent(decodeURIComponent(part)))
        .join("/")}`.slice(0, 512) || "/"
    );
  } catch {
    return null;
  }
}

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
      mode?: "idle" | "post_chat" | "fallback";
      limit?: number;
      visitorId?: string;
      sessionId?: string;
      excludeIds?: string[];
      isFirstVisit?: boolean;
      isReturningSession?: boolean;
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
    const pagePath = normalizePagePath(body.pagePath);

    const built = await runWithAgentTurnContext(
      {
        organizationId: scope.organizationId,
        requestId,
        apiKeyId: auth.apiKeyId ?? undefined,
      },
      () =>
        buildProactiveSuggestions({
          organizationId: scope.organizationId,
          pagePath,
          pageUrl: body.pageUrl ?? null,
          recentMessages: Array.isArray(body.recentMessages)
            ? body.recentMessages.slice(-10).map((m) => ({
                role: String(m.role ?? "user"),
                content: String(m.content ?? "").slice(0, 500),
              }))
            : [],
          mode:
            body.mode === "post_chat"
              ? "post_chat"
              : body.mode === "fallback"
                ? "fallback"
                : "idle",
          limit: body.limit,
          visitorId,
          sessionId,
          excludeIds,
          isFirstVisit: body.isFirstVisit === true,
          isReturningSession: body.isReturningSession === true,
        }),
    );

    recordProductUsageSafe({
      organizationId: auth.organizationId,
      apiKeyId: auth.apiKeyId,
      metric: "proactive_refresh",
      requestId,
      metadata: {
        count: built.suggestions.length,
        mode: body.mode ?? "idle",
      },
    });

    return NextResponse.json({
      success: true,
      data: built.suggestions,
    });
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
