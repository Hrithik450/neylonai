import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../postgres/client";
import {
  knowledgeDocuments,
  knowledgePageSections,
} from "../postgres/schema/knowledge";

const MAX_PAGE_SUGGESTIONS = 20;

/**
 * Aggregates proactive suggestion strings stored for every section on a page.
 * Used as the org-specific per-page catalog at runtime.
 */
export async function listKnowledgePageSuggestions(input: {
  organizationId: string;
  sourceIds: string[];
  canonicalPath: string;
}): Promise<string[]> {
  const sourceIds = [...new Set(input.sourceIds.filter(Boolean))];
  const canonicalPath = input.canonicalPath.trim();
  if (!sourceIds.length || !canonicalPath) return [];

  const rows = await db
    .select({
      suggestions: knowledgePageSections.suggestions,
    })
    .from(knowledgePageSections)
    .innerJoin(
      knowledgeDocuments,
      and(
        eq(knowledgeDocuments.id, knowledgePageSections.document_id),
        eq(
          knowledgeDocuments.organization_id,
          knowledgePageSections.organization_id,
        ),
      ),
    )
    .where(
      and(
        eq(knowledgePageSections.organization_id, input.organizationId),
        inArray(knowledgeDocuments.source_id, sourceIds),
        eq(knowledgeDocuments.canonical_path, canonicalPath),
      ),
    )
    .orderBy(asc(knowledgePageSections.position));

  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    if (!Array.isArray(row.suggestions)) continue;
    for (const value of row.suggestions) {
      if (typeof value !== "string") continue;
      const text = value.replace(/\s+/g, " ").trim();
      if (text.length < 8 || text.length > 120) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(text);
      if (out.length >= MAX_PAGE_SUGGESTIONS) return out;
    }
  }
  return out;
}
