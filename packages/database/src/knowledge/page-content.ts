import { and, eq, inArray } from "drizzle-orm";
import { db } from "../postgres/client";
import { knowledgeDocuments } from "../postgres/schema/knowledge";

/** Keeps the grounding prompt small; pages are long and models charge per token. */
const DEFAULT_MAX_CHARS = 2_400;

/**
 * The crawled text of one page, used to ground page-specific proactive
 * suggestions at request time.
 *
 * Always filters by organization_id.
 */
export async function getKnowledgePageText(input: {
  organizationId: string;
  sourceIds: string[];
  canonicalPath: string;
  maxChars?: number;
}): Promise<string> {
  const sourceIds = [...new Set(input.sourceIds.filter(Boolean))];
  const canonicalPath = input.canonicalPath.trim();
  if (!sourceIds.length || !canonicalPath) return "";

  const [row] = await db
    .select({ rawContent: knowledgeDocuments.raw_content })
    .from(knowledgeDocuments)
    .where(
      and(
        eq(knowledgeDocuments.organization_id, input.organizationId),
        inArray(knowledgeDocuments.source_id, sourceIds),
        eq(knowledgeDocuments.canonical_path, canonicalPath),
      ),
    )
    .limit(1);

  const text = row?.rawContent?.replace(/\s+/g, " ").trim() ?? "";
  return text.slice(0, Math.max(0, input.maxChars ?? DEFAULT_MAX_CHARS));
}
