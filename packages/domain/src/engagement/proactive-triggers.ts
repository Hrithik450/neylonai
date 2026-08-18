import {
  markVisitorSectionSuggestionShown,
  type ProactiveTriggerEventType,
  type ProactiveTriggerType,
} from "@neylonai/database";

export type RecordProactiveTriggerInput = {
  organizationId: string;
  eventType: ProactiveTriggerEventType;
  triggerType?: ProactiveTriggerType | null;
  visitorId?: string | null;
  sessionId?: string | null;
  pagePath?: string | null;
  suggestionId?: string | null;
  participantId?: string | null;
  metadata?: Record<string, unknown>;
};

function sectionKeyFromMetadata(
  metadata: Record<string, unknown> | undefined,
): string | null {
  const raw = metadata?.sectionKey;
  if (typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase().slice(0, 96);
  return key || null;
}

/**
 * Side-effect for shown events: advance per-visitor section suggestion state
 * so later refreshes return only remaining prompts.
 */
export async function recordProactiveTriggerEvent(
  input: RecordProactiveTriggerInput,
): Promise<void> {
  if (input.eventType !== "shown") return;
  const visitorId = input.visitorId?.trim();
  const suggestionId = input.suggestionId?.trim();
  const pagePath = input.pagePath?.trim() || "/";
  const sectionKey = sectionKeyFromMetadata(input.metadata);
  if (!visitorId || !suggestionId || !sectionKey) return;

  try {
    await markVisitorSectionSuggestionShown({
      organizationId: input.organizationId,
      visitorId,
      pagePath,
      sectionKey,
      suggestionId,
    });
  } catch {
    // Fire-and-forget — never break the widget telemetry path.
  }
}

export async function recordProactiveTriggerEvents(
  organizationId: string,
  events: Omit<RecordProactiveTriggerInput, "organizationId">[],
): Promise<void> {
  await Promise.all(
    events.map((event) =>
      recordProactiveTriggerEvent({ ...event, organizationId }),
    ),
  );
}
