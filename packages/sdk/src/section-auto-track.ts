import {
  observePageSection,
  type SectionObserveOptions,
} from "./section-dwell";

/** Elements whose `id` is treated as a public section key. */
export const SECTION_TRACK_SELECTOR =
  "section[id], article[id], aside[id], header[id], footer[id]";

const IGNORED_SECTION_IDS = new Set([
  "root",
  "app",
  "main",
  "content",
  "wrapper",
  "page",
  "__next",
]);

function currentPath(): string {
  return typeof window === "undefined" ? "/" : window.location.pathname || "/";
}

function cleanSectionId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:/-]+/g, "-")
    .slice(0, 96);
}

function labelFromSectionId(sectionId: string): string {
  return sectionId
    .split(/[_.:/-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function shouldTrackSectionId(sectionId: string): boolean {
  if (!sectionId || sectionId.length < 2) return false;
  if (IGNORED_SECTION_IDS.has(sectionId)) return false;
  if (sectionId.startsWith("__")) return false;
  return true;
}

function sectionLabelFor(
  element: Element,
  sectionId: string,
): string | undefined {
  const aria = element.getAttribute("aria-label")?.trim();
  if (aria) return aria.slice(0, 160);

  const heading = element.querySelector("h1, h2, h3");
  const text = heading?.textContent?.replace(/\s+/g, " ").trim();
  if (text) return text.slice(0, 160);

  return labelFromSectionId(sectionId);
}

/** Section keys declared on the current page via element `id`. */
export function discoverDomSectionKeys(pagePath?: string): string[] {
  if (typeof document === "undefined") return [];
  const path = pagePath?.trim() || currentPath();
  if (path !== currentPath()) return [];

  const keys = new Set<string>();
  for (const element of document.querySelectorAll(SECTION_TRACK_SELECTOR)) {
    const raw = element.id;
    const sectionId = raw ? cleanSectionId(raw) : "";
    if (sectionId && shouldTrackSectionId(sectionId)) keys.add(sectionId);
  }
  return [...keys].sort();
}

export interface NeylonSectionAutoTrackOptions extends SectionObserveOptions {
  /** Defaults to `window.location.pathname`. */
  pagePath?: string;
  /** Scan root. Defaults to `document`. */
  root?: ParentNode;
}

/**
 * Observes landmark elements with an `id` under `root`.
 * Re-scans on DOM mutations so client-rendered sections are picked up.
 */
export function initNeylonSectionAutoTrack(
  options: NeylonSectionAutoTrackOptions = {},
): () => void {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return () => undefined;
  }

  const pagePath = options.pagePath?.trim().slice(0, 512) || currentPath();
  const root = options.root ?? document;
  const tracked = new Map<Element, () => void>();
  let scheduled = false;

  const scan = () => {
    scheduled = false;
    const present = new Set<Element>();

    for (const node of root.querySelectorAll(SECTION_TRACK_SELECTOR)) {
      if (!(node instanceof Element)) continue;
      present.add(node);

      const sectionId = cleanSectionId(node.id);
      if (!shouldTrackSectionId(sectionId)) continue;

      if (!tracked.has(node)) {
        const unobserve = observePageSection(node, sectionId, {
          pagePath,
          sectionLabel: sectionLabelFor(node, sectionId),
          dwellMs: options.dwellMs,
          intersectionRatio: options.intersectionRatio,
        });
        tracked.set(node, unobserve);
        continue;
      }
    }

    for (const [element, unobserve] of tracked) {
      if (!present.has(element)) {
        unobserve();
        tracked.delete(element);
      }
    }
  };

  const scheduleScan = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(scan);
  };

  scan();

  const observer = new MutationObserver(scheduleScan);
  observer.observe(root === document ? document.documentElement : root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["id", "aria-label"],
  });

  return () => {
    observer.disconnect();
    for (const unobserve of tracked.values()) unobserve();
    tracked.clear();
  };
}
