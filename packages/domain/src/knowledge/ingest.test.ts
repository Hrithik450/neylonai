import { describe, expect, it } from "vitest";
import {
  estimateTokenCount,
  SECTION_MAX_TOKENS,
  SECTION_MIN_TOKENS,
  type WebsitePageSection,
} from "@neylonai/integrations/website";
import {
  buildWebsiteChunkParts,
  chunkPlainText,
  prepareWebsitePageSections,
} from "./ingest";

describe("knowledge chunking", () => {
  it("merges undersized website sections into one chunk part", () => {
    const sections: WebsitePageSection[] = [
      {
        sectionId: "overview",
        heading: "Overview",
        content:
          "Acme helps teams answer customer questions with grounded knowledge.",
        suggestions: ["How does Acme help teams?", "What knowledge does it use?"],
      },
      {
        sectionId: "pricing",
        heading: "Pricing",
        content: "The Pro plan includes advanced integrations and support.",
        suggestions: ["What does Pro include?", "Which integrations are included?"],
      },
    ];

    const parts = buildWebsiteChunkParts(sections);

    expect(parts).toHaveLength(1);
    expect(parts[0]?.sectionId).toBe("overview");
    for (const section of sections) {
      expect(parts[0]?.content).toContain(section.content);
    }
  });

  it("preserves DOM section ids for page-section storage", () => {
    const sections: WebsitePageSection[] = [
      {
        sectionId: "home-overview",
        heading: "Know why visitors leave",
        content: "Short hero copy for the landing page.",
        suggestions: [],
      },
      {
        sectionId: "product-showcase",
        heading: "See everything at a glance",
        content: "Short product showcase copy for the landing page.",
        suggestions: [],
      },
      {
        sectionId: "features-overview",
        heading: "Catch visitors",
        content: "Short features copy for the landing page.",
        suggestions: [],
      },
    ];

    const pageSections = prepareWebsitePageSections(sections, "dom");
    expect(pageSections.map((section) => section.sectionId)).toEqual([
      "home-overview",
      "product-showcase",
      "features-overview",
    ]);
    expect(
      pageSections.every((section) => section.suggestions.length >= 2),
    ).toBe(true);

    // Chunks may still merge for embeddings — that must not affect stored keys.
    expect(buildWebsiteChunkParts(pageSections).length).toBeLessThan(
      pageSections.length,
    );
  });

  it("keeps website chunks at or above the section token floor", () => {
    const sections: WebsitePageSection[] = Array.from(
      { length: 20 },
      (_, index) => ({
        sectionId: `topic-${index}`,
        heading: `Topic ${index}`,
        content: Array.from(
          { length: 10 },
          (_, line) =>
            `Topic ${index} note ${line} documents one supported capability in detail.`,
        ).join(" "),
        suggestions: [`What is topic ${index}?`],
      }),
    );

    const parts = buildWebsiteChunkParts(sections);

    expect(parts.length).toBeGreaterThan(1);
    expect(
      parts.every(
        (part) => estimateTokenCount(part.content) >= SECTION_MIN_TOKENS,
      ),
    ).toBe(true);
  });

  it("splits an oversized website section before chunk creation", () => {
    const content = Array.from(
      { length: 700 },
      (_, index) => `Capability ${index} has documented behavior.`,
    ).join(" ");
    const parts = buildWebsiteChunkParts([
      {
        sectionId: "capabilities",
        heading: "Capabilities",
        content,
        suggestions: [
          "What capabilities are supported?",
          "How do capabilities behave?",
        ],
      },
    ]);

    expect(parts.length).toBeGreaterThan(1);
    expect(
      parts.every(
        (part) => estimateTokenCount(part.content) <= SECTION_MAX_TOKENS,
      ),
    ).toBe(true);
  });

  it("keeps sliding-window chunking for non-website documents", () => {
    const text = Array.from(
      { length: 1_000 },
      (_, index) => `Generic document sentence ${index}.`,
    ).join(" ");
    expect(chunkPlainText(text).length).toBeGreaterThan(1);
  });
});
