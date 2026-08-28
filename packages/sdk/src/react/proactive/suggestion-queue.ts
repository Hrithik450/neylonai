import type { ProactiveSuggestionDto } from "../..";

export interface QueuedSuggestion {
  id: string;
  text: string;
  source: ProactiveSuggestionDto["source"];
  requestedAt: number;
}

export interface SuggestionQueue {
  items: QueuedSuggestion[];
}

export const EMPTY_SUGGESTION_QUEUE: SuggestionQueue = {
  items: [],
};

function toQueued(suggestions: ProactiveSuggestionDto[]): QueuedSuggestion[] {
  const now = Date.now();
  return suggestions
    .filter((s) => typeof s.id === "string" && typeof s.text === "string")
    .map((s) => ({
      id: s.id,
      text: s.text,
      source: s.source,
      requestedAt: now,
    }));
}

function dedupeAppend(
  existing: QueuedSuggestion[],
  incoming: QueuedSuggestion[],
): QueuedSuggestion[] {
  const seen = new Set(existing.map((item) => item.id));
  const unique = incoming.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  return [...existing, ...unique];
}

export function enqueueSuggestions(
  queue: SuggestionQueue,
  suggestions: ProactiveSuggestionDto[],
): SuggestionQueue {
  const newItems = toQueued(suggestions);
  if (!newItems.length) return queue;
  return {
    items: dedupeAppend(queue.items, newItems),
  };
}

export function prependSuggestions(
  queue: SuggestionQueue,
  suggestions: ProactiveSuggestionDto[],
): SuggestionQueue {
  const newItems = toQueued(suggestions);
  if (!newItems.length) return queue;
  // Dedupe keeping the prepended items first
  const existingIds = new Set(newItems.map((item) => item.id));
  const filteredExisting = queue.items.filter((item) => !existingIds.has(item.id));
  return {
    items: [...newItems, ...filteredExisting],
  };
}

export function dequeueNextSuggestion(queue: SuggestionQueue): {
  suggestion: QueuedSuggestion | null;
  updatedQueue: SuggestionQueue;
} {
  const [suggestion, ...rest] = queue.items;
  if (!suggestion) {
    return { suggestion: null, updatedQueue: { items: [] } };
  }
  return {
    suggestion,
    updatedQueue: { items: rest },
  };
}

export function parseSuggestionQueue(raw: unknown): SuggestionQueue {
  if (!raw || typeof raw !== "object") return { ...EMPTY_SUGGESTION_QUEUE };
  const q = raw as Partial<SuggestionQueue>;
  const items = Array.isArray(q.items)
    ? q.items.flatMap((item): QueuedSuggestion[] => {
        if (!item || typeof item !== "object") return [];
        const row = item as Partial<QueuedSuggestion>;
        if (typeof row.id !== "string" || typeof row.text !== "string") {
          return [];
        }
        return [
          {
            id: row.id,
            text: row.text,
            source: (row.source ?? "page") as QueuedSuggestion["source"],
            requestedAt:
              typeof row.requestedAt === "number" ? row.requestedAt : 0,
          },
        ];
      })
    : [];

  return {
    items: items.slice(0, 40),
  };
}

/** @deprecated Use enqueueSuggestions */
export function enqueueSessionSuggestions(
  queue: SuggestionQueue,
  suggestions: ProactiveSuggestionDto[],
): SuggestionQueue {
  return enqueueSuggestions(queue, suggestions);
}

/** @deprecated Section queues removed — use enqueueSuggestions */
export function enqueueSectionSuggestions(
  queue: SuggestionQueue,
  _sectionKey: string,
  suggestions: ProactiveSuggestionDto[],
): SuggestionQueue {
  return enqueueSuggestions(queue, suggestions);
}

/** @deprecated Section locks removed */
export function isSectionQueueLocked(_queue: SuggestionQueue): boolean {
  return false;
}

/** @deprecated Section fetches removed */
export function requestSectionFetch(queue: SuggestionQueue): {
  queue: SuggestionQueue;
  shouldFetch: boolean;
} {
  return { queue, shouldFetch: false };
}

/** @deprecated Section fetches removed */
export function nextPendingFetchSectionKey(): string | null {
  return null;
}

/** @deprecated Section fetches removed */
export function shiftPendingFetchSectionKey(
  queue: SuggestionQueue,
): SuggestionQueue {
  return queue;
}
