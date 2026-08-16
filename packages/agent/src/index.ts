// Ensure agents + providers are registered on import.
import "./agents/main-agent";
import "./infrastructure/knowledge-search";
import "@neylonai/integrations";

export {
  registerAgent,
  getAgent,
  getDefaultAgent,
  getDefaultAgentId,
  isDefaultAgent,
  listAgentDefinitions,
  listAgentManifests,
  getAgentManifest,
  setDefaultAgent,
  toAgentManifest,
  getMissingRequiredIntegrations,
  sortAgentsForDisplay,
} from "./domain";
export type {
  AgentDefinition,
  AgentManifest,
  AgentConfigField,
  AgentActivityKind,
  AgentOutcomeMetric,
  AgentRole,
  AgentKind,
  AgentTurnContext,
  ConversationMessage,
  AgentEvent,
  StreamConversationInput,
} from "./domain";

export { streamConversation } from "./application/stream-conversation";
export {
  detectEscalation,
  buildHandoffSummary,
  type EscalationDecision,
} from "./application/escalation";
export {
  loadOrgCapabilities,
  resolveAgentTools,
  isOrgAgentEnabled,
  TOOL_INTEGRATION_GATES,
} from "./application/resolve-agent-tools";
export type { OrgCapabilitySnapshot } from "./application/resolve-agent-tools";
export { reframeQuery } from "./application/reframe-query";
export { buildAgentGraph } from "./application/build-agent-graph";
export {
  routeModel,
  classifyComplexityHeuristic,
  getModelForComplexity,
  parseCreditClassifierDecision,
  buildEstimatorUserMessage,
  buildFallbackRoute,
  buildHeuristicRoute,
  toTurnCreditEstimate,
  type ComplexityTier,
  type ModelRoute,
  type CreditEstimatorInput,
} from "./application/model-router";
export {
  buildHeuristicTips,
  startThinkingTipsRefresh,
  type ThinkingTipsResult,
} from "./application/thinking-tips";
export {
  buildProactiveSuggestions,
  type BuildSuggestionsInput,
  type ProactiveSuggestion,
  type SuggestionSource,
} from "./agents/main-agent/proactive-suggestions";
export {
  runWithAgentTurnContext,
  withAgentTurnContext,
  getAgentTurnContext,
  patchAgentTurnContext,
  appendProvenanceHits,
  takeProvenanceHits,
  getTurnBillingSignals,
  recordRoutedModel,
  recordCreditEstimate,
  type AgentTurnContextStore,
} from "./infrastructure/agent-turn-context";
export {
  knowledgeSearchProviders,
  postgresKnowledgeSearchProvider,
  DEFAULT_EMBEDDING_MODEL,
  type KnowledgeSearchProvider,
  type KnowledgeSearchHit,
} from "./infrastructure/knowledge-search";
export {
  prompts,
  THINKING_TIPS_COUNT,
  type PromptName,
} from "./lib/prompts";
export {
  MODEL_DEFAULTS,
  resolveModelId,
  getClassifierModel,
  getAgentModelLow,
  getAgentModelMedium,
  getAgentModelHigh,
  getTipsModel,
  getUtilityModel,
  getEmbeddingModel,
  getSttModel,
} from "./lib/models";
export {
  transcribeAudio,
  estimateAudioInputTokens,
  MAX_AUDIO_BYTES,
  MAX_AUDIO_DURATION_MS,
  GEMINI_AUDIO_TOKENS_PER_SECOND,
  type TranscribeAudioInput,
  type TranscribeAudioResult,
} from "./application/transcribe-audio";
