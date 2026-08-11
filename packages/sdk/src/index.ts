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
export { streamChat, type StreamChatInput } from "./chat";
export {
  transcribeAudio,
  type TranscribeAudioClientInput,
  type TranscribeAudioResult,
} from "./transcribe";
export { listThreads, listMessages } from "./threads";
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
export { trackAnalytics } from "./analytics";
export {
  widgetAudioManager,
  WidgetAudioManager,
  SUGGESTION_POP_SOUND_PATH,
  type WidgetAudioManagerOptions,
} from "./sounds";
export {
  fetchWidgetConfig,
  mergeWidgetConfig,
  withPlatformBrandingColors,
  brandingColorsNeedMigration,
  BRANDING_COLORS_VERSION,
  shouldShowWidgetOnPath,
  shouldAutoOpenOnPath,
  pathMatchesPrefixes,
  DEFAULT_WIDGET_CONFIG,
  DEFAULT_WIDGET_MESSAGES,
  DEFAULT_WIDGET_LAYOUT,
  DEFAULT_WIDGET_FEATURES,
  type StoredWidgetConfig,
  type WidgetFontConfig,
} from "./widget-config";
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
} from "./types";
