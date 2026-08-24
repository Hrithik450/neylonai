import { describe, expect, it } from "vitest";
import { processWebsitePages } from "./process-pages";

describe("processWebsitePages", () => {
  it("keeps DOM headings inline so chunks break on topic boundaries", () => {
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
          {
            sectionId: "support",
            heading: "Support",
            content: "Every plan includes email support.",
          },
        ],
      },
    ]);

    const page = processed.get("/");
    expect(page?.usedDomSections).toBe(true);
    expect(page?.cleanedText).toBe(
      [
        "## Pricing",
        "Plans start at $19 per month for growing teams.",
        "",
        "## Support",
        "Every plan includes email support.",
      ].join("\n"),
    );
  });

  it("skips DOM blocks with no content", () => {
    const processed = processWebsitePages([
      {
        pageKey: "/",
        url: "https://example.com/",
        title: "Home",
        text: "fallback body",
        domSections: [
          { sectionId: "hero", heading: "Hero", content: "   " },
          { sectionId: "pricing", heading: "Pricing", content: "Plans here." },
        ],
      },
    ]);

    expect(processed.get("/")?.cleanedText).toBe("## Pricing\nPlans here.");
  });

  it("falls back to cleaned page text without DOM ids", () => {
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
    expect(page?.cleanedText).toBe(text);
  });
});
