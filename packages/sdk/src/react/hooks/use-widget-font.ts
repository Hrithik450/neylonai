"use client";

import { useEffect, useMemo } from "react";
import type { WidgetFontConfig } from "../../widget-config";
import {
  DEFAULT_WIDGET_FONT,
  SYSTEM_UI_FONT_STACK,
  getFontCatalogEntry,
} from "../../font-catalog";
import { apiUrl } from "../../network";

const LINK_ATTR = "data-neylonai-font";
const STYLE_ATTR = "data-neylonai-font-face";
const INHERIT_ATTR = "data-neylonai-font-inherit";

function injectStylesheet(href: string): void {
  if (typeof document === "undefined" || !href) return;
  const existing = document.querySelector(`link[${LINK_ATTR}="1"]`);
  if (existing instanceof HTMLLinkElement) {
    if (existing.href === href) return;
    existing.href = href;
    return;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.setAttribute(LINK_ATTR, "1");
  document.head.appendChild(link);
}

function injectFontFace(family: string, url: string): void {
  if (typeof document === "undefined" || !family || !url) return;
  const css = `@font-face{font-family:${JSON.stringify(family)};src:url(${JSON.stringify(url)}) format("woff2"),url(${JSON.stringify(url)}) format("woff"),url(${JSON.stringify(url)});font-display:swap;font-weight:100 900;font-style:normal;}`;
  let style = document.querySelector(`style[${STYLE_ATTR}="1"]`);
  if (!(style instanceof HTMLStyleElement)) {
    style = document.createElement("style");
    style.setAttribute(STYLE_ATTR, "1");
    document.head.appendChild(style);
  }
  style.textContent = css;
}

/**
 * Host pages (e.g. dashboard `.paper h2`) often set heading font-family and
 * override inheritance. Force widget text to use the shell font.
 */
function injectWidgetFontInherit(): void {
  if (typeof document === "undefined") return;
  if (document.querySelector(`style[${INHERIT_ATTR}="1"]`)) return;
  const style = document.createElement("style");
  style.setAttribute(INHERIT_ATTR, "1");
  style.textContent = `
[data-neylonai-widget] h1,
[data-neylonai-widget] h2,
[data-neylonai-widget] h3,
[data-neylonai-widget] h4,
[data-neylonai-widget] p,
[data-neylonai-widget] button,
[data-neylonai-widget] input,
[data-neylonai-widget] textarea,
[data-neylonai-widget] label,
[data-neylonai-widget] a,
[data-neylonai-widget] span,
[data-neylonai-widget] li {
  font-family: inherit;
}
`.trim();
  document.head.appendChild(style);
}

function clearInjectedFonts(): void {
  if (typeof document === "undefined") return;
  document.querySelector(`link[${LINK_ATTR}="1"]`)?.remove();
  document.querySelector(`style[${STYLE_ATTR}="1"]`)?.remove();
}

export function resolveWidgetFontFamily(
  font?: WidgetFontConfig | null,
): string {
  if (font?.family?.trim()) return font.family.trim();
  if (font?.catalogId) {
    const entry = getFontCatalogEntry(font.catalogId);
    if (entry) return entry.family;
  }
  return DEFAULT_WIDGET_FONT.family;
}

/**
 * Loads catalog/custom font assets and returns CSS font-family for the shell.
 * Always forces a widget-owned stack so host/dashboard fonts cannot leak in.
 */
export function useWidgetFont(font?: WidgetFontConfig | null): {
  fontFamily: string;
} {
  const resolved = useMemo(() => {
    const source = font?.source ?? "system";
    if (source === "custom" && font?.family?.trim()) {
      return {
        fontFamily: `"${font.family.trim().replace(/"/g, "")}", ${SYSTEM_UI_FONT_STACK}`,
        cssUrl: undefined as string | undefined,
        customUrl: font.customFontUrl,
        customFamily: font.family.trim(),
        customFontId: font.customFontId,
      };
    }
    const catalogId = font?.catalogId ?? DEFAULT_WIDGET_FONT.catalogId;
    const entry = getFontCatalogEntry(catalogId);
    return {
      fontFamily: entry?.family ?? DEFAULT_WIDGET_FONT.family,
      cssUrl: font?.cssUrl ?? entry?.cssUrl,
      customUrl: undefined as string | undefined,
      customFamily: undefined as string | undefined,
      customFontId: undefined as string | undefined,
    };
  }, [font]);

  useEffect(() => {
    injectWidgetFontInherit();
    if (resolved.cssUrl) {
      injectStylesheet(resolved.cssUrl);
      document.querySelector(`style[${STYLE_ATTR}="1"]`)?.remove();
      return;
    }
    if (resolved.customFamily && (resolved.customUrl || resolved.customFontId)) {
      const url =
        resolved.customUrl ||
        apiUrl(`/api/v1/org-fonts/${resolved.customFontId}/file`);
      injectFontFace(resolved.customFamily, url);
      document.querySelector(`link[${LINK_ATTR}="1"]`)?.remove();
      return;
    }
    clearInjectedFonts();
  }, [resolved]);

  return { fontFamily: resolved.fontFamily };
}
