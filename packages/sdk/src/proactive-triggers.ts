import { tryGetAuthHeaders } from "./runtime-config";
import { apiUrl } from "./network";
import { getOrCreateSessionId, getOrCreateVisitorId } from "./visitor";

export type ProactiveTriggerType = "idle";

export type ProactiveTriggerEventType = "shown" | "clicked" | "dismissed";

export type ProactiveTriggerTelemetryEvent = {
  eventType: ProactiveTriggerEventType;
  triggerType?: ProactiveTriggerType | null;
  pagePath?: string | null;
  suggestionId?: string | null;
  metadata?: Record<string, unknown>;
};

/** Fire-and-forget durable proactive trigger telemetry. */
export function trackProactiveTriggers(
  events: ProactiveTriggerTelemetryEvent[],
): void {
  if (events.length === 0) return;
  try {
    const auth = tryGetAuthHeaders({ "Content-Type": "application/json" });
    if ("error" in auth) return;

    const visitorId = getOrCreateVisitorId();
    const sessionId = getOrCreateSessionId();

    void fetch(apiUrl("/api/v1/proactive-triggers"), {
      method: "POST",
      headers: auth.headers,
      body: JSON.stringify({
        events: events.map((event) => ({
          ...event,
          visitorId,
          sessionId,
        })),
      }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // ignore
  }
}

export function trackProactiveTrigger(
  event: ProactiveTriggerTelemetryEvent,
): void {
  trackProactiveTriggers([event]);
}
