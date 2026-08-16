export const KNOWLEDGE_GAP_TYPES = [
  "no_retrieval",
  "negative_feedback",
  "unhelpful_escalation",
  "low_confidence_escalation",
] as const;
export type KnowledgeGapType = (typeof KNOWLEDGE_GAP_TYPES)[number];

export const PROACTIVE_TRIGGER_TYPES = [
  "idle",
  "scroll_depth",
  "dwell",
  "exit_intent",
] as const;
export type ProactiveTriggerType = (typeof PROACTIVE_TRIGGER_TYPES)[number];

export const PROACTIVE_TRIGGER_EVENT_TYPES = [
  "scroll_depth",
  "dwell",
  "exit_intent",
  "shown",
  "clicked",
  "dismissed",
] as const;
export type ProactiveTriggerEventType = (typeof PROACTIVE_TRIGGER_EVENT_TYPES)[number];
