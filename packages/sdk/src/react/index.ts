/** Public React surface for customer embeds + first-party hosts. */
export { SupportWidget } from "./support-widget";
export { useSupportWidget } from "./use-support-widget";
export type {
  SupportWidgetConfig,
  SupportWidgetProps,
  StoredWidgetConfig,
} from "./config/types";
export {
  WIDGET_FONT_CATALOG,
  DEFAULT_WIDGET_FONT,
  SYSTEM_UI_FONT_STACK,
  getFontCatalogEntry,
  matchCatalogByFamilyName,
  type WidgetFontCatalogEntry,
} from "../font-catalog";
export {
  defineWidgetCustomization,
  type WidgetFontConfig,
} from "../widget-config";
export {
  createPageSectionId,
  getTrackedPageSection,
  type TrackedPageSection,
} from "../page-context";
export {
  observePageSection,
  type SectionObserveOptions,
} from "../section-dwell";

/** First-party / advanced composition (landing mock, nav open helpers). */
export { WidgetHostProvider, useWidgetHost } from "./context/widget-host";
export { Widget } from "./widget/widget";
export { WidgetHome } from "./widget/widget-tabs/widget-home";
export { WidgetFaqs } from "./widget/widget-faqs";
export { ConversationUI } from "./widget/conversation-ui";
export {
  WidgetTabs,
  WidgetScreens,
  type WidgetTabType,
  type WidgetScreenType,
} from "./constants";
export {
  useWidgetToggleStore,
  useWidgetNavigationStore,
} from "./store/widget-store";
