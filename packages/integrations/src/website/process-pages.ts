import {
  cleanHeading,
  deterministicCleanPageText,
} from "./page-text";

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
  /**
   * Cleaned page text, with DOM headings kept inline as `## Heading` so the
   * token chunker breaks on real topic boundaries and retrieval keeps context.
   */
  cleanedText: string;
  usedDomSections: boolean;
};

function buildDomProcessedPage(page: WebsiteProcessingInput): ProcessedWebsitePage {
  const cleanedText = (page.domSections ?? [])
    .map((section) => ({
      heading: cleanHeading(section.heading) || section.sectionId,
      content: section.content.trim(),
    }))
    .filter((section) => Boolean(section.content))
    .map((section) => `## ${section.heading}\n${section.content}`)
    .join("\n\n")
    .trim();

  return {
    pageKey: page.pageKey,
    cleanedText: cleanedText || page.text.trim(),
    usedDomSections: true,
  };
}

function buildOverviewProcessedPage(
  page: WebsiteProcessingInput,
): ProcessedWebsitePage {
  return {
    pageKey: page.pageKey,
    cleanedText: deterministicCleanPageText(page.text) || page.text.trim(),
    usedDomSections: false,
  };
}

/**
 * Deterministic website page processing. Pages with landmark element ids keep
 * their heading structure; pages without fall back to cleaned page text.
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
