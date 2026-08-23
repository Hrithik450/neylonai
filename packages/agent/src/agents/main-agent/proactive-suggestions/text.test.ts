import { describe, expect, it } from "vitest";
import { bubbleDedupeKey, cleanQuestion, cleanWelcome } from "./text";

describe("cleanQuestion", () => {
  it("keeps a well-formed bubble as-is", () => {
    expect(cleanQuestion("Ready to see the 5-minute setup? 🚀")).toBe(
      "Ready to see the 5-minute setup? 🚀",
    );
  });

  it("adds a question mark and an emoji when the model omits them", () => {
    const cleaned = cleanQuestion("Curious what the free plan covers");
    expect(cleaned).toMatch(/^Curious what the free plan covers\?\s\p{Extended_Pictographic}$/u);
  });

  it("strips list markers, quotes and Q: prefixes", () => {
    expect(cleanQuestion('2) "Q: Want a quick demo?" 👀')).toBe(
      "Want a quick demo? 👀",
    );
  });

  it("keeps exactly one emoji when the model piles them on", () => {
    const cleaned = cleanQuestion("Want support that never sleeps? 💬🔥✨");
    expect(cleaned?.match(/\p{Extended_Pictographic}/gu)).toHaveLength(1);
  });

  it("rejects lines that are too short or too long", () => {
    expect(cleanQuestion("Why?")).toBeNull();
    expect(
      cleanQuestion(
        "Are you ready to finally see how our platform can transform every part of your support workflow today?",
      ),
    ).toBeNull();
  });

  it("rejects secret-adjacent and link-shaped lines", () => {
    expect(cleanQuestion("Want to see the api_key for this org? 🔥")).toBeNull();
    expect(cleanQuestion("Visit https://example.com for pricing? 🚀")).toBeNull();
    expect(cleanQuestion("navigation path to pricing? 🚀")).toBeNull();
  });

  it("rejects lines left dangling on a stop word", () => {
    expect(cleanQuestion("Curious about the")).toBeNull();
  });
});

describe("cleanWelcome", () => {
  it("normalizes a greeting to one exclamation and one emoji", () => {
    expect(cleanWelcome("Hey — welcome to Neylon AI!!! 👋👋")).toBe(
      "Hey — welcome to Neylon AI! 👋",
    );
  });

  it("rejects an empty or emoji-only greeting", () => {
    expect(cleanWelcome("👋")).toBeNull();
    expect(cleanWelcome("   ")).toBeNull();
  });
});

describe("bubbleDedupeKey", () => {
  it("treats emoji and punctuation variants as the same bubble", () => {
    expect(bubbleDedupeKey("Ready to talk real pricing? 🤔")).toBe(
      bubbleDedupeKey("ready to talk real pricing 💰"),
    );
  });

  it("keeps genuinely different bubbles apart", () => {
    expect(bubbleDedupeKey("Ready to talk real pricing? 🤔")).not.toBe(
      bubbleDedupeKey("Ready to book a demo? 🚀"),
    );
  });
});
