import { createHash } from "node:crypto";
import {
  cacheGet,
  cacheSet,
  findKnowledgePageSection,
  searchKnowledgeByKeyword,
} from "@neylonai/database";
import { listAllowedSourceIds } from "@neylonai/domain/knowledge";

export interface PageSectionSignal {
  sectionId: string;
  /** Untrusted UI/model context only — never used as a database lookup key. */
  sectionLabel?: string | null;
}

export interface ResolvedPageSectionContext extends PageSectionSignal {
  content: string;
  suggestions: string[];
}

const CACHE_TTL_SECONDS = 10 * 60;

function cacheKey(input: {
  organizationId: string;
  agentId: string;
  pagePath: string;
  section: PageSectionSignal;
}): string {
  const digest = createHash("sha256")
    .update(
      [
        input.organizationId,
        input.agentId,
        input.pagePath,
        input.section.sectionId,
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 32);
  return `page-section-context:v3:${digest}`;
}

/**
 * Resolves a tiny client-side section signal against tenant-scoped stored
 * knowledge. Results are shared across visitors; no live website text is sent.
 */
export async function resolvePageSectionContext(input: {
  organizationId: string;
  agentId: string;
  pagePath: string;
  section: PageSectionSignal | null | undefined;
}): Promise<ResolvedPageSectionContext | null> {
  const sectionId = input.section?.sectionId.trim();
  const pagePath = input.pagePath.trim();
  if (!sectionId || !pagePath) return null;

  const section: PageSectionSignal = {
    sectionId: sectionId.slice(0, 96),
    sectionLabel: input.section?.sectionLabel?.trim().slice(0, 160) || null,
  };
  const key = cacheKey({ ...input, pagePath, section });
  const cached = await cacheGet(key);
  if (cached) {
    try {
      return JSON.parse(cached) as ResolvedPageSectionContext;
    } catch {
      // Resolve again after malformed cache data.
    }
  }

  const sourceIds = await listAllowedSourceIds(
    input.organizationId,
    input.agentId,
  );
  if (!sourceIds.length) {
    await cacheSet(key, "null", CACHE_TTL_SECONDS);
    return null;
  }

  const storedSection = await findKnowledgePageSection({
    organizationId: input.organizationId,
    sourceIds,
    canonicalPath: pagePath,
    sectionIds: [section.sectionId],
  });
  if (storedSection) {
    const result: ResolvedPageSectionContext = {
      ...section,
      content: storedSection.content.slice(0, 8_000),
      suggestions: storedSection.suggestions.slice(0, 4),
    };
    await cacheSet(key, JSON.stringify(result), CACHE_TTL_SECONDS);
    return result;
  }

  // Exact key missed: fall back to keyword search on the section key tokens.
  const query = section.sectionId.replace(/[_.:/-]+/g, " ").trim();
  const hits = query
    ? await searchKnowledgeByKeyword({
        organizationId: input.organizationId,
        sourceIds,
        canonicalPath: pagePath,
        query,
        limit: 3,
      })
    : [];

  const content = hits
    .map((hit) => hit.content.trim())
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 2_400);
  if (!content) {
    await cacheSet(key, "null", CACHE_TTL_SECONDS);
    return null;
  }

  const result: ResolvedPageSectionContext = {
    ...section,
    content,
    suggestions: [],
  };
  await cacheSet(key, JSON.stringify(result), CACHE_TTL_SECONDS);
  return result;
}
