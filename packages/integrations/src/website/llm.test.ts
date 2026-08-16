import { afterEach, describe, expect, it } from "vitest";
import {
  packWebsiteProcessingBatches,
  reconcileSectionKeys,
  validateProcessedWebsiteBatch,
  type WebsiteProcessingInput,
} from "./llm";
import { SECTION_MAX_CHARS } from "./sections";

const originalTpm = process.env.UTILITY_MODEL_TPM;
const originalUtilization = process.env.GEMINI_BATCH_TPM_UTILIZATION;

afterEach(() => {
  if (originalTpm === undefined) delete process.env.UTILITY_MODEL_TPM;
  else process.env.UTILITY_MODEL_TPM = originalTpm;
  if (originalUtilization === undefined) {
    delete process.env.GEMINI_BATCH_TPM_UTILIZATION;
  } else {
    process.env.GEMINI_BATCH_TPM_UTILIZATION = originalUtilization;
  }
});

describe("unified website processing", () => {
  it("reuses an existing key when section content changes", () => {
    const sections = reconcileSectionKeys(
      [
        {
          sectionId: "renamed-company-story",
          heading: "Our updated story",
          content:
            "Acme builds reliable customer support automation for growing teams and now includes multilingual workflows.",
          suggestions: ["What does Acme build?", "Which workflows are included?"],
        },
        {
          sectionId: "new-security",
          heading: "Security",
          content:
            "Customer data is encrypted in transit and at rest with managed key rotation.",
          suggestions: ["How is data protected?", "Are keys rotated?"],
        },
      ],
      [
        {
          sectionId: "company-story",
          content:
            "Acme builds reliable customer support automation for growing teams.",
        },
      ],
    );

    expect(sections[0]?.sectionId).toBe("company-story");
    expect(sections[1]?.sectionId).toBe("new-security");
  });

  it("honors an existing key even after all section wording changes", () => {
    const sections = reconcileSectionKeys(
      [
        {
          sectionId: "pricing",
          heading: "Current plans",
          content: "Completely revised plan details.",
          suggestions: ["Which plans are available?", "How much do plans cost?"],
        },
      ],
      [
        {
          sectionId: "pricing",
          content: "Old plan details that are no longer current.",
        },
      ],
    );

    expect(sections[0]?.sectionId).toBe("pricing");
  });

  it("validates multi-page clean, section, and seed output", () => {
    const pages: WebsiteProcessingInput[] = [
      {
        pageKey: "/",
        url: "https://example.com/",
        title: "Home",
        text: "Acme helps support teams answer customer questions with grounded product knowledge.",
      },
      {
        pageKey: "/pricing",
        url: "https://example.com/pricing",
        title: "Pricing",
        text: "The Pro plan includes advanced integrations and priority support for growing teams.",
      },
    ];
    const raw = JSON.stringify({
      pages: [
        {
          pageKey: "/",
          sections: [
            {
              sectionId: "overview",
              heading: "Overview",
              content: pages[0]!.text,
              suggestions: [
                "How does Acme help support teams?",
                "What knowledge does Acme use?",
              ],
            },
          ],
        },
        {
          pageKey: "/pricing",
          sections: [
            {
              sectionId: "pro-plan",
              heading: "Pro plan",
              content: pages[1]!.text,
              suggestions: [
                "What does the Pro plan include?",
                "Does Pro include priority support?",
                "Which integrations come with Pro?",
              ],
            },
          ],
        },
      ],
    });

    const processed = validateProcessedWebsiteBatch(raw, pages);
    expect(processed.size).toBe(2);
    expect(processed.get("/")?.sections[0]?.suggestions).toHaveLength(2);
    expect(processed.get("/pricing")?.sections[0]?.suggestions).toHaveLength(3);
    expect(processed.get("/")?.usedFallback).toBe(false);
  });

  it("keeps scraped text when sections contain invented content", () => {
    const pages: WebsiteProcessingInput[] = [
      {
        pageKey: "/",
        url: "https://example.com/",
        title: "Home",
        text: "Acme provides customer support software for small teams.",
      },
    ];
    const raw = JSON.stringify({
      pages: [
        {
          pageKey: "/",
          sections: [
            {
              sectionId: "overview",
              heading: "Overview",
              content:
                "Acme provides unlimited free support software for every company.",
              suggestions: ["Is Acme free?", "Who can use Acme?"],
            },
          ],
        },
      ],
    });

    const page = validateProcessedWebsiteBatch(raw, pages).get("/")!;
    expect(page.usedFallback).toBe(true);
    expect(page.cleanedText).toBe(pages[0]!.text);
  });

  it("tops up seeds and drops chrome fragments on short pages", () => {
    const pages: WebsiteProcessingInput[] = [
      {
        pageKey: "/contact",
        url: "https://example.com/contact",
        title: "Contact",
        text: "Email hi@example.com or call +1 555 0100 to reach the support team any weekday.",
      },
    ];
    const raw = JSON.stringify({
      pages: [
        {
          pageKey: "/contact",
          sections: [
            {
              sectionId: "menu",
              heading: "Menu",
              content: "Contact",
              suggestions: [],
            },
            {
              sectionId: "contact",
              heading: "Contact support",
              content:
                "Email hi@example.com or call +1 555 0100 to reach the support team any weekday.",
              suggestions: ["How do I reach support?"],
            },
          ],
        },
      ],
    });

    const sections =
      validateProcessedWebsiteBatch(raw, pages).get("/contact")!.sections;
    expect(sections).toHaveLength(1);
    expect(sections[0]?.suggestions).toEqual([
      "How do I reach support?",
      "How does Contact support work?",
    ]);
  });

  it("keeps scraped text when the model rewrites names or voice", () => {
    const sourceSentences = Array.from(
      { length: 6 },
      (_, index) =>
        `Hruthik M is the founder and he shipped release ${index} for enterprise support teams.`,
    );
    const pages: WebsiteProcessingInput[] = [
      {
        pageKey: "/about",
        url: "https://example.com/about",
        title: "About",
        text: sourceSentences.join("\n\n"),
      },
    ];
    const raw = JSON.stringify({
      pages: [
        {
          pageKey: "/about",
          sections: sourceSentences.map((sentence, index) => ({
            sectionId: `founder-${index}`,
            heading: `Founder ${index}`,
            content: sentence.replace(
              "Hruthik M is the founder and he",
              "I'm the founder and I",
            ),
            suggestions: ["Who founded the company?", "What did they ship?"],
          })),
        },
      ],
    });

    const page = validateProcessedWebsiteBatch(raw, pages).get("/about")!;
    expect(page.usedFallback).toBe(true);
    expect(page.cleanedText).toContain("Hruthik M is the founder");
    expect(page.cleanedText).not.toContain("I'm the founder");
  });

  it("accepts verbatim content after markdown reflow", () => {
    const pages: WebsiteProcessingInput[] = [
      {
        pageKey: "/about",
        url: "https://example.com/about",
        title: "About",
        text: "## About us\n\n*  We build **support** tooling for growing teams.\n\n[Contact us](mailto:hi@example.com)",
      },
    ];
    const raw = JSON.stringify({
      pages: [
        {
          pageKey: "/about",
          sections: [
            {
              sectionId: "about-us",
              heading: "About us",
              content:
                "We build support tooling for growing teams. Contact us hi@example.com",
              suggestions: [
                "What tooling do you build?",
                "How can I contact you?",
              ],
            },
          ],
        },
      ],
    });

    const page = validateProcessedWebsiteBatch(raw, pages).get("/about")!;
    expect(page.usedFallback).toBe(false);
    expect(page.sections).toHaveLength(1);
  });

  it("splits oversized validated output into section-sized parts", () => {
    const content = Array.from(
      { length: SECTION_MAX_CHARS / 4 },
      (_, index) => `fact-${index}`,
    ).join(" ");
    const pages: WebsiteProcessingInput[] = [
      {
        pageKey: "/docs",
        url: "https://example.com/docs",
        title: "Docs",
        text: content,
      },
    ];
    const raw = JSON.stringify({
      pages: [
        {
          pageKey: "/docs",
          sections: [
            {
              sectionId: "docs",
              heading: "Documentation",
              content,
              suggestions: [
                "What does the documentation cover?",
                "Where should I begin reading?",
              ],
            },
          ],
        },
      ],
    });

    expect(
      validateProcessedWebsiteBatch(raw, pages).get("/docs")!.sections.length,
    ).toBeGreaterThan(1);
  });

  it("splits crawl batches only when the model budget requires it", () => {
    process.env.UTILITY_MODEL_TPM = "100";
    process.env.GEMINI_BATCH_TPM_UTILIZATION = "0.5";
    const pages: WebsiteProcessingInput[] = ["/a", "/b", "/c"].map(
      (pageKey) => ({
        pageKey,
        url: `https://example.com${pageKey}`,
        title: pageKey,
        text: "A useful page body with enough content to process.",
      }),
    );

    expect(packWebsiteProcessingBatches(pages)).toHaveLength(3);
  });
});
