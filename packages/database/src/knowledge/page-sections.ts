import { and, asc, eq, inArray } from "drizzle-orm";
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

export type PageSectionKeyManifest = Record<string, string[]>;

export interface ExistingPageSection {
  sectionId: string;
  content: string;
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

/**
 * Path-scoped section keys for SDK codegen. Keys and paths are sorted so
 * generated TypeScript stays deterministic across crawls that only reorder.
 */
export async function listKnowledgePageSectionKeys(input: {
  organizationId: string;
  sourceIds: string[];
}): Promise<PageSectionKeyManifest> {
  const sourceIds = [...new Set(input.sourceIds.filter(Boolean))];
  if (!sourceIds.length) return {};

  const rows = await db
    .select({
      path: knowledgeDocuments.canonical_path,
      sectionKey: knowledgePageSections.section_key,
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
      ),
    )
    .orderBy(
      asc(knowledgeDocuments.canonical_path),
      asc(knowledgePageSections.position),
      asc(knowledgePageSections.section_key),
    );

  const byPath = new Map<string, Set<string>>();
  for (const row of rows) {
    const path = row.path?.trim() || "/";
    const key = row.sectionKey?.trim();
    if (!key) continue;
    const existing = byPath.get(path) ?? new Set<string>();
    existing.add(key);
    byPath.set(path, existing);
  }

  const manifest: PageSectionKeyManifest = {};
  for (const path of [...byPath.keys()].sort()) {
    manifest[path] = [...(byPath.get(path) ?? [])].sort();
  }
  return manifest;
}

/** Load prior page sections before a refresh so Gemini can preserve their keys. */
export async function listExistingPageSections(input: {
  organizationId: string;
  sourceId: string;
  canonicalPaths: string[];
}): Promise<Record<string, ExistingPageSection[]>> {
  const paths = [...new Set(input.canonicalPaths.map((path) => path.trim()))]
    .filter(Boolean);
  if (!input.sourceId.trim() || !paths.length) return {};

  const rows = await db
    .select({
      path: knowledgeDocuments.canonical_path,
      sectionId: knowledgePageSections.section_key,
      content: knowledgePageSections.content,
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
        eq(knowledgeDocuments.source_id, input.sourceId),
        inArray(knowledgeDocuments.canonical_path, paths),
      ),
    )
    .orderBy(
      asc(knowledgeDocuments.canonical_path),
      asc(knowledgePageSections.position),
    );

  const byPath: Record<string, ExistingPageSection[]> = {};
  for (const row of rows) {
    const path = row.path?.trim();
    if (!path) continue;
    (byPath[path] ??= []).push({
      sectionId: row.sectionId,
      content: row.content,
    });
  }
  return byPath;
}
