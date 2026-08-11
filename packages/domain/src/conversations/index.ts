export type {
  ConversationLifecycleStatus,
  EscalationTrigger,
  ConversationStateRecord,
  EscalateConversationInput,
  EngagementSettings,
} from "./types";
export { DEFAULT_ENGAGEMENT_SETTINGS } from "./types";
export {
  getEngagementSettings,
  saveEngagementSettings,
  getConversationStateByThread,
  ensureConversationState,
  escalateConversation,
  resolveConversation,
  returnToAi,
  recordLastAgent,
  postHumanReply,
  canAiRespond,
} from "./service";
export {
  getAgentPerformance,
  getAgentOutcomeCounts,
  type AgentActivityItem,
  type AgentPerformanceSnapshot,
} from "./performance";
