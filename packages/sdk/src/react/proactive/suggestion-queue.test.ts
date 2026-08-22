import { describe, expect, it } from "vitest";
import type { ProactiveSuggestionDto } from "../..";
import {
  EMPTY_SUGGESTION_QUEUE,
  dequeueNextSuggestion,
  enqueueSuggestions,
} from "./suggestion-queue";

const pageSug = (id: string, text: string): ProactiveSuggestionDto => ({
  id,
  text,
  source: "page",
});

describe("suggestion queue", () => {
  it("appends suggestions in FIFO order", () => {
    const queue = enqueueSuggestions(EMPTY_SUGGESTION_QUEUE, [
      pageSug("s1", "Session one?"),
      pageSug("s2", "Session two?"),
      pageSug("s3", "Session three?"),
    ]);

    expect(queue.items.map((i) => i.id)).toEqual(["s1", "s2", "s3"]);
  });

  it("dedupes by id when appending", () => {
    let queue = enqueueSuggestions(EMPTY_SUGGESTION_QUEUE, [
      pageSug("s1", "One?"),
    ]);
    queue = enqueueSuggestions(queue, [pageSug("s1", "One again?"), pageSug("s2", "Two?")]);
    expect(queue.items.map((i) => i.id)).toEqual(["s1", "s2"]);
  });

  it("dequeues in FIFO order", () => {
    const queue = enqueueSuggestions(EMPTY_SUGGESTION_QUEUE, [
      pageSug("a1", "A1?"),
      pageSug("a2", "A2?"),
    ]);

    const first = dequeueNextSuggestion(queue);
    expect(first.suggestion?.id).toBe("a1");
    expect(first.updatedQueue.items.map((i) => i.id)).toEqual(["a2"]);

    const second = dequeueNextSuggestion(first.updatedQueue);
    expect(second.suggestion?.id).toBe("a2");
    expect(second.updatedQueue.items).toEqual([]);
  });
});
