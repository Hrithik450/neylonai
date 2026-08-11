import { NextRequest, NextResponse } from "next/server";
import {
  isApiKeyAuthContext,
  requireApiKeyAuth,
} from "@/server/api-key-auth";
import { trackEventlySafe } from "@neylonai/integrations/evently";

export const dynamic = "force-dynamic";

const ALLOWED = new Set([
  "widget_impression",
  "widget_opened",
  "widget_closed",
  "suggestion_clicked",
  "suggestion_dismissed",
  "agent_selected",
  "agent_completed",
  "lead_created",
  "integration_used",
]);

/**
 * Fire-and-forget product analytics from the SDK.
 * Never required for chatbot function; Evently outage must not break UX.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiKeyAuth(req);
    if (!isApiKeyAuthContext(auth)) return auth;

    const body = (await req.json().catch(() => ({}))) as {
      event?: string;
      pagePath?: string;
      suggestionId?: string;
      agentId?: string;
      integrationId?: string;
      sessionId?: string;
      visitorId?: string;
      properties?: Record<string, string | number | boolean | null>;
    };

    if (!body.event || !ALLOWED.has(body.event)) {
      return NextResponse.json(
        { success: false, error: "Unsupported event" },
        { status: 400 },
      );
    }

    trackEventlySafe({
      event: body.event,
      organizationId: auth.organizationId,
      pagePath: body.pagePath ?? null,
      suggestionId: body.suggestionId ?? null,
      agentId: body.agentId ?? null,
      integrationId: body.integrationId ?? null,
      sessionId: body.sessionId ?? null,
      visitorId: body.visitorId ?? null,
      properties: body.properties,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // Analytics must not surface as hard failures to the widget.
    console.warn("[analytics]", error);
    return NextResponse.json({ success: true, degraded: true });
  }
}
