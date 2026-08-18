import { and, eq, inArray } from "drizzle-orm";
import { db } from "../postgres/client";
import {
  knowledgeDocuments,
  knowledgePageSections,
} from "../postgres/schema/knowledge";

export interface StoredPageSection {
  sectionId: string;
  content: string;
  provider: string;
  sectioner: string;
  suggestions: string[];
}

function toStoredPageSection(
  row:
    | {
        sectionId: string;
        content: string;
        provider: string;
        sectioner: string;
        suggestions: unknown;
      }
    | undefined,
): StoredPageSection | null {
  return row
    ? {
        ...row,
        suggestions: Array.isArray(row.suggestions)
          ? row.suggestions.filter(
              (value): value is string => typeof value === "string",
            )
          : [],
      }
    : null;
}

export async function findKnowledgePageSection(input: {
  organizationId: string;
  sourceIds: string[];
  canonicalPath: string;
  sectionIds: string[];
}): Promise<StoredPageSection | null> {
  const sourceIds = [...new Set(input.sourceIds.filter(Boolean))];
  const sectionIds = [...new Set(input.sectionIds.filter(Boolean))];
  if (!sourceIds.length || !input.canonicalPath.trim() || !sectionIds.length) {
    return null;
  }

  const [exact] = await db
    .select({
      sectionId: knowledgePageSections.section_key,
      content: knowledgePageSections.content,
      provider: knowledgePageSections.provider,
      sectioner: knowledgePageSections.sectioner,
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
        eq(knowledgeDocuments.canonical_path, input.canonicalPath),
        inArray(knowledgePageSections.section_key, sectionIds),
      ),
    )
    .limit(1);

  return toStoredPageSection(exact);
}
