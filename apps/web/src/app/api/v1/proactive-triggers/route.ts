import { NextRequest, NextResponse } from "next/server";
import {
  PROACTIVE_TRIGGER_EVENT_TYPES,
  PROACTIVE_TRIGGER_TYPES,
} from "@neylonai/database";
import { recordProactiveTriggerEvents } from "@neylonai/domain/engagement";
import {
  isApiKeyAuthContext,
  requireApiKeyAuth,
} from "@/server/api-key-auth";

export const dynamic = "force-dynamic";

const EVENT_TYPES = new Set<string>(PROACTIVE_TRIGGER_EVENT_TYPES);
const TRIGGER_TYPES = new Set<string>(PROACTIVE_TRIGGER_TYPES);

type TriggerBody = {
  events?: Array<{
    eventType?: string;
    triggerType?: string | null;
    visitorId?: string | null;
    sessionId?: string | null;
    pagePath?: string | null;
    suggestionId?: string | null;
    metadata?: Record<string, unknown>;
  }>;
};

/**
 * Persist high-value proactive trigger telemetry from the widget SDK.
 * Fire-and-forget friendly — invalid rows are skipped, not fatal.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiKeyAuth(req);
    if (!isApiKeyAuthContext(auth)) return auth;

    const body = (await req.json().catch(() => ({}))) as TriggerBody;
    const rawEvents = Array.isArray(body.events) ? body.events : [];
    if (rawEvents.length === 0) {
      return NextResponse.json(
        { success: false, error: "events array is required" },
        { status: 400 },
      );
    }

    const events = rawEvents
      .slice(0, 20)
      .map((event) => {
        const eventType = event.eventType?.trim();
        if (!eventType || !EVENT_TYPES.has(eventType)) return null;
        const triggerType = event.triggerType?.trim() ?? null;
        if (triggerType && !TRIGGER_TYPES.has(triggerType)) return null;
        return {
          eventType: eventType as (typeof PROACTIVE_TRIGGER_EVENT_TYPES)[number],
          triggerType: triggerType as
            | (typeof PROACTIVE_TRIGGER_TYPES)[number]
            | null,
          visitorId: event.visitorId ?? null,
          sessionId: event.sessionId ?? null,
          pagePath: event.pagePath ?? null,
          suggestionId: event.suggestionId ?? null,
          metadata:
            event.metadata && typeof event.metadata === "object"
              ? event.metadata
              : {},
        };
      })
      .filter((event): event is NonNullable<typeof event> => Boolean(event));

    if (events.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid events" },
        { status: 400 },
      );
    }

    await recordProactiveTriggerEvents(auth.organizationId, events);

    return NextResponse.json({ success: true, recorded: events.length });
  } catch (error) {
    console.warn("[proactive-triggers]", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to record events",
      },
      { status: 500 },
    );
  }
}
