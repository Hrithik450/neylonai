export {
  persistMessageCitations,
  loadCitationsForMessages,
  hashCitationKey,
  type DashboardCitation,
} from "./citations";

export {
  normalizeQuestionForHash,
  hashKnowledgeGapQuestion,
  buildKnowledgeGapDedupKey,
  recordKnowledgeGapEvent,
  aggregateKnowledgeGaps,
  gapTypeToLabel,
  finalizeAssistantEngagement,
  type KnowledgeGapAggregate,
} from "./knowledge-gaps";

export {
  recordProactiveTriggerEvent,
  recordProactiveTriggerEvents,
  type RecordProactiveTriggerInput,
} from "./proactive-triggers";
