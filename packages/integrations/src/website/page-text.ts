/**
 * Text helpers for crawled website pages.
 *
 * Page text is chunked by the shared token-window chunker in ingest; these
 * helpers only normalize the text and the heading ids that structure it.
 */

export function sectionIdFromHeading(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

export function cleanHeading(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/**
 * Light deterministic cleanup for scraped page text.
 * Does not summarize — only strips obvious cookie/nav chrome lines.
 */
export function deterministicCleanPageText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim().toLowerCase();
      if (!trimmed) return true;
      if (/^(cookie|accept all cookies|manage cookies)\b/.test(trimmed)) {
        return false;
      }
      if (/^(skip to (main )?content|menu|navigation)$/.test(trimmed)) {
        return false;
      }
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
