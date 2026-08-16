import {
  clearTrackedPageSection,
  trackPageSection,
  type TrackedPageSection,
} from "./page-context";

export interface SectionObserveOptions {
  /** Display label passed to chat / suggestion context. */
  sectionLabel?: string;
  /** Defaults to `window.location.pathname`. */
  pagePath?: string;
  /** Ms the section must stay primary before a seed request qualifies (default 4500). */
  dwellMs?: number;
  /** Min intersection ratio to count as viewing (default 0.35). */
  intersectionRatio?: number;
}

const DEFAULT_DWELL_MS = 4_500;
const DEFAULT_RATIO = 0.35;

type QualifiedListener = (section: TrackedPageSection) => void;

const qualifiedListeners = new Set<QualifiedListener>();
/** Pending dwell timers keyed by `pagePath:sectionId`. */
const pendingDwell = new Map<string, ReturnType<typeof setTimeout>>();

function currentPath(): string {
  return typeof window === "undefined" ? "/" : window.location.pathname || "/";
}

function scopeKey(section: { sectionId: string; pagePath: string }): string {
  return `${section.pagePath}:${section.sectionId}`;
}

function cleanSectionId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_.:/-]+/g, "-").slice(0, 96);
}

/** Subscribe to sections that passed the dwell threshold (triggers seed fetch). */
export function subscribeToQualifiedPageSection(
  listener: QualifiedListener,
): () => void {
  qualifiedListeners.add(listener);
  return () => qualifiedListeners.delete(listener);
}

function emitQualified(section: TrackedPageSection): void {
  qualifiedListeners.forEach((listener) => listener(section));
}

function cancelPendingDwell(key: string): void {
  const timer = pendingDwell.get(key);
  if (timer) {
    clearTimeout(timer);
    pendingDwell.delete(key);
  }
}

function scheduleQualification(
  section: TrackedPageSection,
  dwellMs: number,
): void {
  const key = scopeKey(section);
  cancelPendingDwell(key);
  const timer = setTimeout(() => {
    pendingDwell.delete(key);
    emitQualified(section);
  }, dwellMs);
  pendingDwell.set(key, timer);
}

/**
 * Marks a section as qualified immediately (e.g. custom visibility logic).
 * Prefer {@link observePageSection} for the standard IntersectionObserver flow.
 */
export function qualifyPageSection(input: {
  sectionId: string;
  sectionLabel?: string;
  pagePath?: string;
}): void {
  const sectionId = cleanSectionId(input.sectionId);
  if (!sectionId) return;
  const section: TrackedPageSection = {
    sectionId,
    sectionLabel: input.sectionLabel,
    pagePath: input.pagePath?.trim().slice(0, 512) || currentPath(),
  };
  trackPageSection(section);
  emitQualified(section);
}

/**
 * Observe a page section element. Updates chat context immediately when the
 * section is primary; emits a qualification event (seed fetch) only after the
 * visitor dwells long enough. Fast scrolls cancel the pending qualification.
 */
export function observePageSection(
  element: Element,
  sectionId: string,
  options?: SectionObserveOptions,
): () => void {
  if (typeof IntersectionObserver === "undefined") {
    return () => undefined;
  }

  const cleanedId = cleanSectionId(sectionId);
  if (!cleanedId) return () => undefined;

  const dwellMs = Math.max(2_000, options?.dwellMs ?? DEFAULT_DWELL_MS);
  const ratioThreshold = Math.min(
    1,
    Math.max(0.1, options?.intersectionRatio ?? DEFAULT_RATIO),
  );
  const pagePath = options?.pagePath?.trim().slice(0, 512) || currentPath();
  const sectionLabel = options?.sectionLabel;

  let isPrimary = false;

  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (!entry) return;

      const nowPrimary =
        entry.isIntersecting && entry.intersectionRatio >= ratioThreshold;

      if (nowPrimary && !isPrimary) {
        isPrimary = true;
        const section: TrackedPageSection = {
          sectionId: cleanedId,
          sectionLabel,
          pagePath,
        };
        trackPageSection(section);
        scheduleQualification(section, dwellMs);
        return;
      }

      if (!nowPrimary && isPrimary) {
        isPrimary = false;
        cancelPendingDwell(scopeKey({ sectionId: cleanedId, pagePath }));
        clearTrackedPageSection(cleanedId);
      }
    },
    { threshold: [0, ratioThreshold, 0.5, 0.75, 1] },
  );

  observer.observe(element);

  return () => {
    observer.disconnect();
    if (isPrimary) {
      cancelPendingDwell(scopeKey({ sectionId: cleanedId, pagePath }));
      clearTrackedPageSection(cleanedId);
    }
  };
}

/** Register section keys for a page path (internal). */
export function registerPageSections(
  pagePath: string,
  sectionKeys: string[],
): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return;
  }
  const path = pagePath.trim().slice(0, 512) || "/";
  const keys = [
    ...new Set(sectionKeys.map(cleanSectionId).filter(Boolean)),
  ].sort();
  if (!keys.length) return;
  try {
    localStorage.setItem(
      `neylonai.pageSections.v1:${path}`,
      JSON.stringify(keys),
    );
  } catch {
    // quota / private mode
  }
}

export function getRegisteredPageSections(pagePath: string): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(
      `neylonai.pageSections.v1:${pagePath.trim() || "/"}`,
    );
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((k): k is string => typeof k === "string");
  } catch {
    return [];
  }
}
