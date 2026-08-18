export interface TrackedPageSection {
  sectionId: string;
  sectionLabel?: string;
  pagePath: string;
}

type PageSectionListener = (section: TrackedPageSection | null) => void;

const listeners = new Set<PageSectionListener>();
let activeSection: TrackedPageSection | null = null;

function currentPath(): string {
  return typeof window === "undefined" ? "/" : window.location.pathname || "/";
}

function cleanId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_.:/-]+/g, "-").slice(0, 96);
}

/** Returns the active section only when it belongs to the visitor's current page. */
export function getTrackedPageSection(): TrackedPageSection | null {
  if (!activeSection || activeSection.pagePath !== currentPath()) return null;
  return activeSection;
}

/**
 * Marks a meaningful page section as active. This makes no network request;
 * chat and proactive requests read the latest value when they already run.
 */
export function trackPageSection(input: {
  sectionId: string;
  /** Optional display label for model context — not used for DB lookup. */
  sectionLabel?: string;
  pagePath?: string;
}): void {
  const sectionId = cleanId(input.sectionId);
  if (!sectionId) return;

  const next: TrackedPageSection = {
    sectionId,
    sectionLabel: input.sectionLabel?.replace(/\s+/g, " ").trim().slice(0, 160) || undefined,
    pagePath: input.pagePath?.trim().slice(0, 512) || currentPath(),
  };
  if (
    activeSection?.sectionId === next.sectionId &&
    activeSection.pagePath === next.pagePath &&
    activeSection.sectionLabel === next.sectionLabel
  ) {
    return;
  }

  activeSection = next;
  listeners.forEach((listener) => listener(next));
}

export function clearTrackedPageSection(sectionId?: string): void {
  if (sectionId && activeSection?.sectionId !== cleanId(sectionId)) return;
  if (!activeSection) return;
  activeSection = null;
  listeners.forEach((listener) => listener(null));
}

/** Internal subscription used by the widget; exported for framework adapters. */
export function subscribeToPageSection(listener: PageSectionListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
