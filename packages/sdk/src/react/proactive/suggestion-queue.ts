import type { ProactiveSuggestionDto } from "../..";

export interface QueuedSuggestion {
  id: string;
  text: string;
  source: ProactiveSuggestionDto["source"];
  sectionKey?: string;
  priority: "section" | "session";
  requestedAt: number;
}

export interface SuggestionQueue {
  items: QueuedSuggestion[];
  /** Section currently being drained; other section fetches wait. */
  lockedSectionKey: string | null;
  lockedUntil: number | null;
  /** Section keys waiting to be fetched once the lock clears. */
  pendingFetchSectionKeys: string[];
}

export const EMPTY_SUGGESTION_QUEUE: SuggestionQueue = {
  items: [],
  lockedSectionKey: null,
  lockedUntil: null,
  pendingFetchSectionKeys: [],
};

const SECTION_LOCK_MS = 30_000;

function toQueued(
  suggestions: ProactiveSuggestionDto[],
  priority: "section" | "session",
  sectionKey?: string,
): QueuedSuggestion[] {
  const now = Date.now();
  return suggestions
    .filter((s) => typeof s.id === "string" && typeof s.text === "string")
    .map((s) => ({
      id: s.id,
      text: s.text,
      source: s.source,
      sectionKey: sectionKey ?? s.contextKey,
      priority,
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

export function isSectionQueueLocked(
  queue: SuggestionQueue,
  now = Date.now(),
): boolean {
  return Boolean(
    queue.lockedSectionKey &&
      queue.lockedUntil != null &&
      now < queue.lockedUntil,
  );
}

/**
 * Append section suggestions after existing queue items so the session batch
 * drains before section prompts on a first visit.
 */
export function enqueueSectionSuggestions(
  queue: SuggestionQueue,
  sectionKey: string,
  suggestions: ProactiveSuggestionDto[],
): SuggestionQueue {
  const newItems = toQueued(suggestions, "section", sectionKey);
  if (!newItems.length) return queue;

  const incomingIds = new Set(newItems.map((item) => item.id));
  const withoutDupes = queue.items.filter((item) => !incomingIds.has(item.id));

  return {
    ...queue,
    items: [...withoutDupes, ...newItems],
    pendingFetchSectionKeys: queue.pendingFetchSectionKeys.filter(
      (key) => key !== sectionKey,
    ),
  };
}

/** Append session/general suggestions at the end (behind section items). */
export function enqueueSessionSuggestions(
  queue: SuggestionQueue,
  suggestions: ProactiveSuggestionDto[],
): SuggestionQueue {
  const newItems = toQueued(suggestions, "session");
  if (!newItems.length) return queue;
  return {
    ...queue,
    items: dedupeAppend(queue.items, newItems),
  };
}

/**
 * Decide whether a section dwell may fetch now, or must wait for the lock.
 * Returns the updated queue and whether the caller should fetch immediately.
 */
export function requestSectionFetch(
  queue: SuggestionQueue,
  sectionKey: string,
  now = Date.now(),
): { queue: SuggestionQueue; shouldFetch: boolean } {
  if (!sectionKey) return { queue, shouldFetch: false };

  const alreadyQueued = queue.items.some(
    (item) => item.sectionKey === sectionKey && item.priority === "section",
  );
  if (alreadyQueued) {
    return { queue, shouldFetch: false };
  }

  if (
    isSectionQueueLocked(queue, now) &&
    queue.lockedSectionKey !== sectionKey
  ) {
    if (queue.pendingFetchSectionKeys.includes(sectionKey)) {
      return { queue, shouldFetch: false };
    }
    return {
      queue: {
        ...queue,
        pendingFetchSectionKeys: [
          ...queue.pendingFetchSectionKeys,
          sectionKey,
        ],
      },
      shouldFetch: false,
    };
  }

  return { queue, shouldFetch: true };
}

export function dequeueNextSuggestion(
  queue: SuggestionQueue,
  now = Date.now(),
): { suggestion: QueuedSuggestion | null; updatedQueue: SuggestionQueue } {
  if (queue.items.length === 0) {
    return {
      suggestion: null,
      updatedQueue: {
        ...queue,
        lockedSectionKey: null,
        lockedUntil: null,
      },
    };
  }

  if (isSectionQueueLocked(queue, now)) {
    const nextIdx = queue.items.findIndex(
      (item) => item.sectionKey === queue.lockedSectionKey,
    );

    if (nextIdx === -1) {
      return dequeueNextSuggestion({
        ...queue,
        lockedSectionKey: null,
        lockedUntil: null,
      }, now);
    }

    const suggestion = queue.items[nextIdx]!;
    const updatedItems = queue.items.filter((_, i) => i !== nextIdx);
    const hasMoreFromSection = updatedItems.some(
      (item) => item.sectionKey === queue.lockedSectionKey,
    );

    return {
      suggestion,
      updatedQueue: {
        items: updatedItems,
        lockedSectionKey: hasMoreFromSection ? queue.lockedSectionKey : null,
        lockedUntil: hasMoreFromSection ? queue.lockedUntil : null,
        pendingFetchSectionKeys: queue.pendingFetchSectionKeys,
      },
    };
  }

  const [suggestion, ...rest] = queue.items;
  if (!suggestion) {
    return { suggestion: null, updatedQueue: queue };
  }

  const lockSection =
    suggestion.priority === "section" ? (suggestion.sectionKey ?? null) : null;

  return {
    suggestion,
    updatedQueue: {
      items: rest,
      lockedSectionKey: lockSection,
      lockedUntil: lockSection ? now + SECTION_LOCK_MS : null,
      pendingFetchSectionKeys: queue.pendingFetchSectionKeys,
    },
  };
}

export function nextPendingFetchSectionKey(
  queue: SuggestionQueue,
): string | null {
  return queue.pendingFetchSectionKeys[0] ?? null;
}

export function shiftPendingFetchSectionKey(
  queue: SuggestionQueue,
): SuggestionQueue {
  return {
    ...queue,
    pendingFetchSectionKeys: queue.pendingFetchSectionKeys.slice(1),
  };
}

export function parseSuggestionQueue(
  raw: unknown,
): SuggestionQueue {
  if (!raw || typeof raw !== "object") return { ...EMPTY_SUGGESTION_QUEUE };
  const q = raw as Partial<SuggestionQueue>;
  const items = Array.isArray(q.items)
    ? q.items.flatMap((item): QueuedSuggestion[] => {
        if (!item || typeof item !== "object") return [];
        const row = item as Partial<QueuedSuggestion>;
        if (typeof row.id !== "string" || typeof row.text !== "string") {
          return [];
        }
        if (row.priority !== "section" && row.priority !== "session") {
          return [];
        }
        return [
          {
            id: row.id,
            text: row.text,
            source: (row.source ?? "knowledge") as QueuedSuggestion["source"],
            sectionKey:
              typeof row.sectionKey === "string" ? row.sectionKey : undefined,
            priority: row.priority,
            requestedAt:
              typeof row.requestedAt === "number" ? row.requestedAt : 0,
          },
        ];
      })
    : [];

  return {
    items: items.slice(0, 40),
    lockedSectionKey:
      typeof q.lockedSectionKey === "string" ? q.lockedSectionKey : null,
    lockedUntil: typeof q.lockedUntil === "number" ? q.lockedUntil : null,
    pendingFetchSectionKeys: Array.isArray(q.pendingFetchSectionKeys)
      ? q.pendingFetchSectionKeys.filter(
          (key): key is string => typeof key === "string",
        ).slice(0, 20)
      : [],
  };
}
