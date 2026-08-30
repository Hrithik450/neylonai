export {
  configureNeylonai,
  getApiKey,
  getAuthHeaders,
  tryGetAuthHeaders,
  NeylonaiSdkConfigError,
  parseEventStream,
  isAbortError,
  type ConfigureNeylonaiOptions,
} from "./client";
export { streamChat, type StreamChatInput, type StreamChatUser } from "./chat";
export { buildStreamChatUser } from "./chat-user";
export {
  transcribeAudio,
  type TranscribeAudioClientInput,
  type TranscribeAudioResult,
} from "./transcribe";
export { listThreads, listMessages } from "./threads";
export {
  requestHumanHandoff,
  submitMessageFeedback,
  getLatestHumanReply,
} from "./retention";
export {
  fetchSuggestions,
  type FetchSuggestionsInput,
  type ProactiveSuggestionDto,
} from "./suggestions";
export {
  getOrCreateVisitorId,
  getOrCreateSessionId,
  getChatParticipantId,
} from "./visitor";
export { trackProactiveTrigger, trackProactiveTriggers } from "./proactive-triggers";
export type {
  ProactiveTriggerType,
  ProactiveTriggerEventType,
  ProactiveTriggerTelemetryEvent,
} from "./proactive-triggers";
export {
  widgetAudioManager,
  WidgetAudioManager,
  SUGGESTION_POP_SOUND_PATH,
  type WidgetAudioManagerOptions,
} from "./sounds";
export {
  fetchWidgetConfig,
  defineWidgetCustomization,
  mergeWidgetConfig,
  withPlatformBrandingColors,
  brandingColorsNeedMigration,
  BRANDING_COLORS_VERSION,
  shouldShowWidgetOnPath,
  shouldAutoOpenOnPath,
  pathMatchesPrefixes,
  normalizePathRule,
  validatePathRule,
  DEFAULT_WIDGET_CONFIG,
  DEFAULT_WIDGET_MESSAGES,
  DEFAULT_WIDGET_LAYOUT,
  DEFAULT_WIDGET_FEATURES,
  type StoredWidgetConfig,
  type WidgetFontConfig,
} from "./widget-config";
export {
  WIDGET_THEME_PRESETS,
  DEFAULT_THEME_PRESET_ID,
  resolveThemePreset,
  type ThemePreset,
  type ThemePresetColors,
} from "./widget-presets";
export {
  WIDGET_FONT_CATALOG,
  DEFAULT_WIDGET_FONT,
  SYSTEM_UI_FONT_STACK,
  getFontCatalogEntry,
  matchCatalogByFamilyName,
  type WidgetFontCatalogEntry,
  type WidgetFontCatalogGroup,
} from "./font-catalog";
export type {
  User,
  UserResponse,
  Thread,
  ThreadResponse,
  ThreadsResponse,
  ThreadMessage,
  ThreadMessageResponse,
  ThreadMessagesResponse,
  AgentStreamEvent,
  CreditExhaustionError,
} from "./types";
export { integrationLogoLetters } from "./integration-utils";
export type {
  OrganizationPrivacyPrefs,
  OrganizationSettings,
  OrganizationSettingsPatch,
} from "./organization";
export { DEFAULT_PRIVACY } from "./organization";
export {
  DATABASE_CLOUD_PROVIDERS,
  DATABASE_PRIVATE_PROVIDERS,
  SUPABASE_READONLY_ROLE,
  SUPABASE_READONLY_SETUP_SQL,
  SUPABASE_CONNECTION_URL_EXAMPLES,
  POSTGRES_READONLY_SETUP_SQL,
} from "./database-integration";
export type {
  DatabaseDeploymentKind,
  DatabaseProviderStatus,
  DatabaseCloudProviderId,
  DatabasePrivateProviderId,
  DatabaseProviderId,
  DatabaseProviderOption,
  SupabaseSetupMethod,
} from "./database-integration";
