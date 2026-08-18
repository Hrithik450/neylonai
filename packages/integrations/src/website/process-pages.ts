import {
  cleanHeading,
  deterministicCleanPageText,
  withFallbackSuggestions,
  type WebsitePageSection,
} from "./sections";

export type WebsiteProcessingInput = {
  pageKey: string;
  url: string;
  title: string;
  text: string;
  /** Section boundaries from element `id` attributes in scraped HTML. */
  domSections?: Array<{
    sectionId: string;
    heading: string;
    content: string;
  }>;
};

export type ProcessedWebsitePage = {
  pageKey: string;
  cleanedText: string;
  sections: WebsitePageSection[];
  usedDomSections: boolean;
};

function buildDomProcessedPage(page: WebsiteProcessingInput): ProcessedWebsitePage {
  const sections = withFallbackSuggestions(
    (page.domSections ?? []).map((section) => ({
      sectionId: section.sectionId,
      heading: cleanHeading(section.heading) || section.sectionId,
      content: section.content.trim(),
      suggestions: [],
    })),
  );
  const cleanedText = sections
    .map((section) => `## ${section.heading}\n${section.content}`)
    .join("\n\n")
    .trim();

  return {
    pageKey: page.pageKey,
    cleanedText: cleanedText || page.text.trim(),
    sections,
    usedDomSections: true,
  };
}

function buildOverviewProcessedPage(
  page: WebsiteProcessingInput,
): ProcessedWebsitePage {
  const cleanedText = deterministicCleanPageText(page.text) || page.text.trim();
  const heading = cleanHeading(page.title) || "Page overview";
  const sections = withFallbackSuggestions([
    {
      sectionId: "page-overview",
      heading,
      content: cleanedText,
      suggestions: [],
    },
  ]);

  return {
    pageKey: page.pageKey,
    cleanedText,
    sections,
    usedDomSections: false,
  };
}

/**
 * Deterministic website page processing. Section boundaries come from DOM
 * element ids; pages without landmark ids fall back to a single overview block.
 */
export function processWebsitePages(
  pages: WebsiteProcessingInput[],
): Map<string, ProcessedWebsitePage> {
  const out = new Map<string, ProcessedWebsitePage>();

  for (const page of pages) {
    if (!page.text.trim() && !(page.domSections?.length ?? 0)) continue;

    if (page.domSections?.length) {
      out.set(page.pageKey, buildDomProcessedPage(page));
      continue;
    }

    out.set(page.pageKey, buildOverviewProcessedPage(page));
  }

  return out;
}
