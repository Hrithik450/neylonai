/**
 * Re-exports shared widget config from @neylonai/sdk (single source of truth).
 */
export {
  type StoredWidgetConfig,
  type WidgetFontConfig,
  DEFAULT_WIDGET_CONFIG,
  DEFAULT_WIDGET_FONT,
  WIDGET_FONT_CATALOG,
  SYSTEM_UI_FONT_STACK,
  getFontCatalogEntry,
  matchCatalogByFamilyName,
  mergeWidgetConfig,
  withPlatformBrandingColors,
  brandingColorsNeedMigration,
  BRANDING_COLORS_VERSION,
  WIDGET_THEME_PRESETS,
  DEFAULT_THEME_PRESET_ID,
  resolveThemePreset,
  type ThemePreset,
  type ThemePresetColors,
  pathMatchesPrefixes,
  shouldShowWidgetOnPath,
  shouldAutoOpenOnPath,
} from "@neylonai/sdk";
