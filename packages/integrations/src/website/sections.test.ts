import { describe, expect, it } from "vitest";
import {
  enforceSectionSizeLimit,
  estimateTokenCount,
  SECTION_MAX_TOKENS,
  SECTION_MIN_CHARS,
  SECTION_MIN_TOKENS,
  sectionIdFromHeading,
} from "./sections";

describe("website page sections", () => {
  it("normalizes headings into tracker-compatible ids", () => {
    expect(sectionIdFromHeading("Pricing & Plans!")).toBe("pricing-plans");
  });

  it("splits oversized sections without losing content", () => {
    const paragraphs = Array.from(
      { length: 80 },
      (_, index) =>
        `Paragraph ${index} explains a concrete product capability in enough detail for customers to understand how it works and when to use it.`,
    );
    const content = paragraphs.join("\n\n");
    const sections = enforceSectionSizeLimit([
      {
        sectionId: "capabilities",
        heading: "Capabilities",
        content,
        suggestions: ["What capabilities are available?", "When should I use them?"],
      },
    ]);

    expect(sections.length).toBeGreaterThan(1);
    expect(
      sections.every(
        (section) => estimateTokenCount(section.content) <= SECTION_MAX_TOKENS,
      ),
    ).toBe(true);
    expect(sections.map((section) => section.sectionId)).toEqual(
      sections.map((_, index) =>
        index === 0 ? "capabilities" : `capabilities-${index + 1}`,
      ),
    );
    expect(
      sections
        .map((section) => section.content)
        .join(" ")
        .replace(/\s+/g, " "),
    ).toBe(content.replace(/\s+/g, " "));
  });

  it("merges undersized sections up to the token floor", () => {
    const sections = Array.from({ length: 12 }, (_, index) => ({
      sectionId: `topic-${index}`,
      heading: `Topic ${index}`,
      content: Array.from(
        { length: 8 },
        (_, line) =>
          `Topic ${index} detail ${line} describes one supported capability for customers.`,
      ).join(" "),
      suggestions: [`What is topic ${index} about?`],
    }));

    const merged = enforceSectionSizeLimit(sections);

    expect(merged.length).toBeLessThan(sections.length);
    expect(
      merged.every(
        (section) => estimateTokenCount(section.content) >= SECTION_MIN_TOKENS,
      ),
    ).toBe(true);
    expect(
      merged.every(
        (section) => estimateTokenCount(section.content) <= SECTION_MAX_TOKENS,
      ),
    ).toBe(true);
    expect(merged[0]?.heading).toBe("Topic 0");
    expect(merged.map((section) => section.content).join(" ")).toContain(
      "Topic 11 detail 7",
    );
  });

  it("keeps a page shorter than the floor as one section", () => {
    const content =
      "Email hi@example.com or call +1 555 0100 to reach the support team any weekday.";
    const sections = enforceSectionSizeLimit([
      {
        sectionId: "contact",
        heading: "Contact support",
        content,
        suggestions: ["How do I reach support?"],
      },
    ]);

    expect(sections).toHaveLength(1);
    expect(sections[0]?.content).toBe(content);
    expect(content.length).toBeLessThan(SECTION_MIN_CHARS);
  });
});
