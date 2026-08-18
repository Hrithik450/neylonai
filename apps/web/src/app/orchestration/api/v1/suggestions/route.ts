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
      pageSection?: {
        sectionId?: string;
        sectionLabel?: string;
        pagePath?: string;
      };
      recentMessages?: Array<{ role: string; content: string }>;
      mode?: "idle" | "post_chat";
      limit?: number;
      visitorId?: string;
      sessionId?: string;
      excludeIds?: string[];
      unshownSectionKeys?: string[];
      triggerType?: "idle" | "scroll_depth" | "dwell" | "exit_intent";
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
    const unshownSectionKeys = Array.isArray(body.unshownSectionKeys)
      ? body.unshownSectionKeys
          .filter((id): id is string => typeof id === "string")
          .map((id) => id.trim().toLowerCase().slice(0, 96))
          .filter((id) => /^[a-z0-9_.:/-]+$/.test(id))
          .slice(0, 12)
      : [];

    const requestId = randomUUID();
    const pagePath = normalizePagePath(body.pagePath);
    const trackedPagePath = normalizePagePath(body.pageSection?.pagePath);
    const rawSectionId =
      typeof body.pageSection?.sectionId === "string"
        ? body.pageSection.sectionId.trim().toLowerCase().slice(0, 96)
        : "";
    const pageSection =
      body.pageSection &&
      (!trackedPagePath || trackedPagePath === pagePath) &&
      /^[a-z0-9_.:/-]+$/.test(rawSectionId)
        ? {
            sectionId: rawSectionId,
            sectionLabel:
              typeof body.pageSection.sectionLabel === "string"
                ? body.pageSection.sectionLabel
                    .replace(/\s+/g, " ")
                    .trim()
                    .slice(0, 160)
                : null,
          }
        : null;

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
          pageSection,
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
          unshownSectionKeys,
          triggerType:
            body.triggerType === "scroll_depth" ||
            body.triggerType === "dwell" ||
            body.triggerType === "exit_intent" ||
            body.triggerType === "idle"
              ? body.triggerType
              : "idle",
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
        triggerType: body.triggerType ?? "idle",
      },
    });

    return NextResponse.json({
      success: true,
      data: built.suggestions,
      sectionState: built.sectionState ?? null,
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
