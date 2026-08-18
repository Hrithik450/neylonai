import { describe, expect, it } from "vitest";
import type { ProactiveSuggestionDto } from "../..";
import {
  EMPTY_SUGGESTION_QUEUE,
  dequeueNextSuggestion,
  enqueueSectionSuggestions,
  enqueueSessionSuggestions,
  requestSectionFetch,
} from "./suggestion-queue";

const sectionSug = (
  id: string,
  text: string,
  sectionKey: string,
): ProactiveSuggestionDto => ({
  id,
  text,
  source: "section",
  contextKey: sectionKey,
});

const sessionSug = (id: string, text: string): ProactiveSuggestionDto => ({
  id,
  text,
  source: "page",
});

describe("suggestion queue", () => {
  it("appends section suggestions after session batch", () => {
    let queue = enqueueSessionSuggestions(EMPTY_SUGGESTION_QUEUE, [
      sessionSug("s1", "Session one?"),
      sessionSug("s2", "Session two?"),
    ]);
    queue = enqueueSectionSuggestions(queue, "pricing", [
      sectionSug("a1", "Pricing A?", "pricing"),
      sectionSug("a2", "Pricing B?", "pricing"),
    ]);

    expect(queue.items.map((i) => i.id)).toEqual(["s1", "s2", "a1", "a2"]);
  });

  it("locks on first section dequeue and prefers that section", () => {
    let queue = enqueueSectionSuggestions(EMPTY_SUGGESTION_QUEUE, "pricing", [
      sectionSug("a1", "A1?", "pricing"),
      sectionSug("a2", "A2?", "pricing"),
    ]);
    queue = enqueueSectionSuggestions(queue, "faq", [
      sectionSug("b1", "B1?", "faq"),
    ]);

    const first = dequeueNextSuggestion(queue, 1_000);
    expect(first.suggestion?.id).toBe("a1");
    expect(first.updatedQueue.lockedSectionKey).toBe("pricing");

    const second = dequeueNextSuggestion(first.updatedQueue, 1_001);
    expect(second.suggestion?.id).toBe("a2");
    expect(second.updatedQueue.lockedSectionKey).toBeNull();
  });

  it("queues section fetch requests while locked to another section", () => {
    let queue = enqueueSectionSuggestions(EMPTY_SUGGESTION_QUEUE, "pricing", [
      sectionSug("a1", "A1?", "pricing"),
    ]);
    const locked = dequeueNextSuggestion(queue, 1_000).updatedQueue;

    const result = requestSectionFetch(locked, "faq", 1_001);
    expect(result.shouldFetch).toBe(false);
    expect(result.queue.pendingFetchSectionKeys).toEqual(["faq"]);
  });

  it("allows fetch when unlocked", () => {
    const open = requestSectionFetch(EMPTY_SUGGESTION_QUEUE, "pricing");
    expect(open.shouldFetch).toBe(true);
  });

  it("skips fetch when section suggestions are already queued", () => {
    const queue = enqueueSectionSuggestions(EMPTY_SUGGESTION_QUEUE, "pricing", [
      sectionSug("a1", "A1?", "pricing"),
    ]);
    const result = requestSectionFetch(queue, "pricing");
    expect(result.shouldFetch).toBe(false);
  });
});
