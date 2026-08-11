export type ScrapeProvider = "firecrawl" | "jina" | "static";

export type ScrapeResult = {
  url: string;
  finalUrl: string;
  title: string;
  text: string;
  html?: string;
  /** Same-origin or discovered links when the provider returns them. */
  links?: string[];
  fetchedAt: string;
  provider: ScrapeProvider;
  /** Provider credits consumed (Firecrawl/Jina page units). */
  creditsUsed?: number;
};
