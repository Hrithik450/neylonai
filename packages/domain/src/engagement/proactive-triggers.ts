import type {
  ProactiveTriggerEventType,
  ProactiveTriggerType,
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

export async function recordProactiveTriggerEvent(
  input: RecordProactiveTriggerInput,
): Promise<void> {
  void input;
}

export async function recordProactiveTriggerEvents(
  organizationId: string,
  events: Omit<RecordProactiveTriggerInput, "organizationId">[],
): Promise<void> {
  void organizationId;
  void events;
}
