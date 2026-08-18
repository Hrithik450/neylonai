export interface WebsitePageSection {
  sectionId: string;
  heading: string;
  content: string;
  suggestions: string[];
}

/** Approx chars-per-token used across website processing + ingest. */
export const APPROX_CHARS_PER_TOKEN = 4;
/**
 * Every section carries at least ~800 tokens; smaller neighbours are merged.
 * A section may reach twice the floor before it is split again, so splitting
 * never produces parts below the floor.
 */
export const SECTION_MIN_TOKENS = 800;
export const SECTION_MAX_TOKENS = SECTION_MIN_TOKENS * 2;
export const SECTION_MIN_CHARS = SECTION_MIN_TOKENS * APPROX_CHARS_PER_TOKEN;
export const SECTION_MAX_CHARS = SECTION_MAX_TOKENS * APPROX_CHARS_PER_TOKEN;

export function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.length / APPROX_CHARS_PER_TOKEN));
}

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

export function fallbackSectionSuggestions(heading: string): string[] {
  const topic = heading
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/[?.!]+$/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join(" ");
  const subject = topic || "this";
  return [
    `How does ${subject} work?`,
    `What should I know about ${subject}?`,
  ];
}

export function withFallbackSuggestions(
  sections: WebsitePageSection[],
): WebsitePageSection[] {
  return sections.map((section) => ({
    ...section,
    suggestions: section.suggestions.length
      ? section.suggestions.slice(0, 4)
      : fallbackSectionSuggestions(section.heading),
  }));
}

export function normalizeSuggestions(values: unknown[]): string[] {
  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter((value) => value.length >= 8 && value.length <= 120)
    .map((value) => (value.endsWith("?") ? value : `${value}?`))
    .slice(0, 4);
}

/** Split text into chunks at paragraph/sentence/word boundaries without
 * dropping content. Each part is at most `maxChars`.
 */
export function splitTextToMaxChars(
  text: string,
  maxChars = SECTION_MAX_CHARS,
): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const parts: string[] = [];
  let remaining = normalized;
  while (remaining.length > maxChars) {
    const window = remaining.slice(0, maxChars);
    const breakAt = Math.max(
      window.lastIndexOf("\n\n"),
      window.lastIndexOf(". "),
      window.lastIndexOf("? "),
      window.lastIndexOf("! "),
      window.lastIndexOf("\n"),
      window.lastIndexOf(" "),
    );
    const boundary = window[breakAt];
    const cut =
      breakAt > maxChars * 0.4
        ? breakAt + (boundary && /[.?!]/.test(boundary) ? 1 : 0)
        : maxChars;
    const slice = remaining.slice(0, cut).trim();
    if (slice) parts.push(slice);
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining) parts.push(remaining);
  return parts;
}

type SizedSection = {
  baseId: string;
  heading: string;
  content: string;
  suggestions: string[];
};

function mergeSuggestions(current: string[], extra: string[]): string[] {
  const merged = [...current];
  for (const value of extra) {
    if (merged.length >= 3) break;
    if (!merged.includes(value)) merged.push(value);
  }
  return merged;
}

/** Appending the merged heading keeps the sub-topic searchable in the chunk. */
function appendSection(target: SizedSection, next: SizedSection): void {
  const prefix =
    next.heading && !next.content.startsWith(next.heading)
      ? `${next.heading}\n`
      : "";
  target.content = `${target.content}\n\n${prefix}${next.content}`.trim();
  target.suggestions = mergeSuggestions(target.suggestions, next.suggestions);
}

/** Merge neighbours until each group carries at least the floor. */
function mergeUndersizedSections(sections: SizedSection[]): SizedSection[] {
  const groups: SizedSection[] = [];
  for (const section of sections) {
    const open = groups[groups.length - 1];
    if (open && open.content.length < SECTION_MIN_CHARS) {
      appendSection(open, section);
      continue;
    }
    groups.push({ ...section });
  }

  // A trailing remainder has no following neighbour, so it merges backwards.
  const last = groups[groups.length - 1];
  if (groups.length > 1 && last && last.content.length < SECTION_MIN_CHARS) {
    appendSection(groups[groups.length - 2]!, last);
    groups.pop();
  }
  return groups;
}

/**
 * Split into even parts that each stay at or above the floor, so enforcing the
 * maximum never undoes the minimum.
 */
function splitAboveFloor(content: string): string[] {
  if (content.length <= SECTION_MAX_CHARS) return [content];
  const partCount = Math.max(1, Math.floor(content.length / SECTION_MIN_CHARS));
  const target = Math.max(
    SECTION_MIN_CHARS,
    Math.ceil(content.length / partCount),
  );
  const parts = splitTextToMaxChars(content, target);
  const tail = parts[parts.length - 1];
  if (parts.length > 1 && tail && tail.length < SECTION_MIN_CHARS) {
    parts[parts.length - 2] = `${parts[parts.length - 2]}\n\n${tail}`.trim();
    parts.pop();
  }
  return parts;
}

/**
 * Normalize sections to ~800 tokens or more: undersized neighbours merge and
 * oversized content splits into ordered continuations with stable ids. Content
 * is never truncated, and a page shorter than the floor stays as one section.
 */
export function enforceSectionSizeLimit(
  sections: WebsitePageSection[],
): WebsitePageSection[] {
  const normalized: SizedSection[] = [];
  for (const section of sections) {
    const content = section.content.replace(/\n{3,}/g, "\n\n").trim();
    if (!content) continue;
    const heading = cleanHeading(section.heading) || "Section";
    normalized.push({
      baseId: sectionIdFromHeading(section.sectionId || heading) || "section",
      heading,
      content,
      suggestions: normalizeSuggestions(section.suggestions),
    });
  }

  const out: WebsitePageSection[] = [];

  for (const section of mergeUndersizedSections(normalized)) {
    const { baseId, heading, suggestions } = section;
    const parts = splitAboveFloor(section.content);

    for (let i = 0; i < parts.length; i++) {
      const partHeading =
        parts.length === 1
          ? heading
          : i === 0
            ? heading
            : `${heading} (${i + 1})`;
      const idBase =
        parts.length === 1 ? baseId : i === 0 ? baseId : `${baseId}-${i + 1}`;
      out.push({
        sectionId: idBase,
        heading: partHeading,
        content: parts[i]!,
        suggestions:
          suggestions.length > 0
            ? suggestions
            : fallbackSectionSuggestions(partHeading),
      });
    }
  }

  return out;
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