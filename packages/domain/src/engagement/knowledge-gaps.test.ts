import { describe, expect, it } from "vitest";
import {
  buildKnowledgeGapDedupKey,
  hashKnowledgeGapQuestion,
  normalizeQuestionForHash,
} from "./knowledge-gaps";
import { hashCitationKey } from "./citations";

describe("knowledge gap helpers", () => {
  it("normalizes questions consistently", () => {
    expect(normalizeQuestionForHash("  What   is   Pricing?  ")).toBe(
      "what is pricing?",
    );
  });

  it("hashes equivalent questions to the same value", () => {
    const a = hashKnowledgeGapQuestion("What is pricing?");
    const b = hashKnowledgeGapQuestion("  what   is pricing? ");
    expect(a).toBe(b);
  });

  it("builds stable dedup keys from message and gap type", () => {
    expect(
      buildKnowledgeGapDedupKey({
        messageId: "msg-1",
        gapType: "negative_feedback",
      }),
    ).toBe("msg-1:negative_feedback");
  });

  it("requires message or request id for dedup keys", () => {
    expect(() =>
      buildKnowledgeGapDedupKey({
        gapType: "no_retrieval",
      }),
    ).toThrow();
  });
});

describe("citation helpers", () => {
  it("hashes citation keys deterministically", () => {
    const a = hashCitationKey("message-a", "chunk-b");
    const b = hashCitationKey("message-a", "chunk-b");
    expect(a).toBe(b);
    expect(a).not.toBe(hashCitationKey("message-a", "chunk-c"));
  });
});
