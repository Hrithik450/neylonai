import { sectionIdFromHeading } from "./sections";

/** Elements whose `id` is treated as a public section key. */
export const SECTION_TRACK_TAGS = [
  "section",
  "article",
  "aside",
  "header",
  "footer",
] as const;

const SECTION_TAG_PATTERN = SECTION_TRACK_TAGS.join("|");
const OPEN_TAG_RE = new RegExp(
  `<(${SECTION_TAG_PATTERN})\\b[^>]*\\bid\\s*=\\s*(["'])([^"']+)\\2[^>]*>`,
  "gi",
);

const IGNORED_SECTION_IDS = new Set([
  "root",
  "app",
  "main",
  "content",
  "wrapper",
  "page",
  "__next",
]);

export interface DomPageSection {
  sectionId: string;
  label: string;
  content: string;
}

export function cleanDomSectionId(value: string): string {
  return sectionIdFromHeading(value.trim()) || "";
}

export function labelFromSectionId(sectionId: string): string {
  return sectionId
    .split(/[_.:/-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

/** Strip tags and collapse whitespace for knowledge section content. */
export function htmlToPlainText(html: string): string {
  return decodeHtmlEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/ *\n{2,} */g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function readAttribute(tag: string, name: string): string | null {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*(["'])([^"']+)\\1`, "i"),
  );
  return match?.[2]?.trim() || null;
}

function findClosingTagIndex(
  html: string,
  tagName: string,
  contentStart: number,
): number {
  const openRe = new RegExp(`<${tagName}\\b[^>]*>`, "gi");
  const closeRe = new RegExp(`</${tagName}\\s*>`, "gi");
  openRe.lastIndex = contentStart;
  closeRe.lastIndex = contentStart;

  let depth = 1;
  while (depth > 0) {
    const nextOpen = openRe.exec(html);
    const nextClose = closeRe.exec(html);
    if (!nextClose) return -1;
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth += 1;
      continue;
    }
    depth -= 1;
    if (depth === 0) return nextClose.index;
  }
  return -1;
}

function headingFromHtml(html: string): string | null {
  const match = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
  if (!match?.[1]) return null;
  const text = htmlToPlainText(match[1]).split("\n")[0]?.trim();
  return text || null;
}

function shouldTrackSectionId(sectionId: string): boolean {
  if (!sectionId || sectionId.length < 2) return false;
  if (IGNORED_SECTION_IDS.has(sectionId)) return false;
  if (sectionId.startsWith("__")) return false;
  return true;
}

/**
 * Extract page sections from rendered HTML using `id` on landmark elements.
 * Section ids are stable public keys shared with the browser SDK.
 */
export function extractDomPageSections(html: string): DomPageSection[] {
  const source = html.replace(/\r\n/g, "\n");
  const sections: DomPageSection[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = OPEN_TAG_RE.exec(source)) !== null) {
    const tagName = match[1]!.toLowerCase();
    const rawId = match[3] ?? "";
    const sectionId = cleanDomSectionId(rawId);
    if (!shouldTrackSectionId(sectionId) || seen.has(sectionId)) continue;

    const openTag = match[0];
    const contentStart = match.index + openTag.length;
    const closeIndex = findClosingTagIndex(source, tagName, contentStart);
    if (closeIndex < 0) continue;

    const innerHtml = source.slice(contentStart, closeIndex);
    const content = htmlToPlainText(innerHtml);
    if (content.length < 20) continue;

    const label =
      readAttribute(openTag, "aria-label") ||
      headingFromHtml(innerHtml) ||
      labelFromSectionId(sectionId);

    seen.add(sectionId);
    sections.push({ sectionId, label, content });
  }

  return sections;
}
