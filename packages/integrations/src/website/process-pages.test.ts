import { describe, expect, it } from "vitest";
import { processWebsitePages } from "./process-pages";

describe("processWebsitePages", () => {
  it("uses DOM section boundaries when present", () => {
    const processed = processWebsitePages([
      {
        pageKey: "/",
        url: "https://example.com/",
        title: "Home",
        text: "ignored markdown body",
        domSections: [
          {
            sectionId: "pricing",
            heading: "Pricing",
            content: "Plans start at $19 per month for growing teams.",
          },
        ],
      },
    ]);

    const page = processed.get("/");
    expect(page?.usedDomSections).toBe(true);
    expect(page?.sections).toHaveLength(1);
    expect(page?.sections[0]?.sectionId).toBe("pricing");
    expect(page?.sections[0]?.suggestions.length).toBeGreaterThanOrEqual(2);
  });

  it("falls back to a single overview section without DOM ids", () => {
    const text =
      "Acme provides customer support software for small teams with grounded answers.";
    const processed = processWebsitePages([
      {
        pageKey: "/about",
        url: "https://example.com/about",
        title: "About",
        text,
      },
    ]);

    const page = processed.get("/about");
    expect(page?.usedDomSections).toBe(false);
    expect(page?.sections).toHaveLength(1);
    expect(page?.sections[0]?.sectionId).toBe("page-overview");
    expect(page?.cleanedText).toBe(text);
  });
});
