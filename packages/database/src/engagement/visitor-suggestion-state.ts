import { and, eq, sql } from "drizzle-orm";
import { db } from "../postgres/client";
import { visitorSuggestionState } from "../postgres/schema/visitor-suggestions";

export interface VisitorSectionSuggestionState {
  shown: string[];
  pending: string[];
  total: number;
}

function normalizeIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return [
    ...new Set(
      ids
        .filter((id): id is string => typeof id === "string")
        .map((id) => id.trim())
        .filter(Boolean)
        .slice(0, 40),
    ),
  ];
}

export async function getVisitorSectionSuggestionState(input: {
  organizationId: string;
  visitorId: string;
  pagePath: string;
  sectionKey: string;
}): Promise<VisitorSectionSuggestionState> {
  const visitorId = input.visitorId.trim().slice(0, 128);
  const pagePath = input.pagePath.trim().slice(0, 512) || "/";
  const sectionKey = input.sectionKey.trim().toLowerCase().slice(0, 96);
  if (!visitorId || !sectionKey) {
    return { shown: [], pending: [], total: 0 };
  }

  const [row] = await db
    .select({
      shown: visitorSuggestionState.shown_suggestion_ids,
      pending: visitorSuggestionState.pending_suggestion_ids,
      total: visitorSuggestionState.total_suggestions_for_section,
    })
    .from(visitorSuggestionState)
    .where(
      and(
        eq(visitorSuggestionState.organization_id, input.organizationId),
        eq(visitorSuggestionState.visitor_id, visitorId),
        eq(visitorSuggestionState.page_path, pagePath),
        eq(visitorSuggestionState.section_key, sectionKey),
      ),
    )
    .limit(1);

  if (!row) return { shown: [], pending: [], total: 0 };

  return {
    shown: normalizeIds(row.shown),
    pending: normalizeIds(row.pending),
    total: row.total,
  };
}

/**
 * Seed or refresh pending ids for a section. Shown ids are preserved;
 * pending becomes suggestionIds minus already shown.
 */
export async function syncVisitorSectionSuggestionPool(input: {
  organizationId: string;
  visitorId: string;
  pagePath: string;
  sectionKey: string;
  suggestionIds: string[];
}): Promise<VisitorSectionSuggestionState> {
  const visitorId = input.visitorId.trim().slice(0, 128);
  const pagePath = input.pagePath.trim().slice(0, 512) || "/";
  const sectionKey = input.sectionKey.trim().toLowerCase().slice(0, 96);
  const suggestionIds = normalizeIds(input.suggestionIds);
  if (!visitorId || !sectionKey) {
    return { shown: [], pending: suggestionIds, total: suggestionIds.length };
  }

  const existing = await getVisitorSectionSuggestionState({
    organizationId: input.organizationId,
    visitorId,
    pagePath,
    sectionKey,
  });
  const shown = existing.shown.filter((id) => suggestionIds.includes(id));
  const pending = suggestionIds.filter((id) => !shown.includes(id));
  const total = suggestionIds.length;

  await db
    .insert(visitorSuggestionState)
    .values({
      organization_id: input.organizationId,
      visitor_id: visitorId,
      page_path: pagePath,
      section_key: sectionKey,
      shown_suggestion_ids: shown,
      pending_suggestion_ids: pending,
      total_suggestions_for_section: total,
      updated_at: sql`now()`,
    })
    .onConflictDoUpdate({
      target: [
        visitorSuggestionState.organization_id,
        visitorSuggestionState.visitor_id,
        visitorSuggestionState.page_path,
        visitorSuggestionState.section_key,
      ],
      set: {
        shown_suggestion_ids: shown,
        pending_suggestion_ids: pending,
        total_suggestions_for_section: total,
        updated_at: sql`now()`,
      },
    });

  return { shown, pending, total };
}

/** Move a suggestion id from pending → shown for this visitor/section. */
export async function markVisitorSectionSuggestionShown(input: {
  organizationId: string;
  visitorId: string;
  pagePath: string;
  sectionKey: string;
  suggestionId: string;
}): Promise<VisitorSectionSuggestionState | null> {
  const visitorId = input.visitorId.trim().slice(0, 128);
  const pagePath = input.pagePath.trim().slice(0, 512) || "/";
  const sectionKey = input.sectionKey.trim().toLowerCase().slice(0, 96);
  const suggestionId = input.suggestionId.trim().slice(0, 64);
  if (!visitorId || !sectionKey || !suggestionId) return null;

  const existing = await getVisitorSectionSuggestionState({
    organizationId: input.organizationId,
    visitorId,
    pagePath,
    sectionKey,
  });

  const shown = existing.shown.includes(suggestionId)
    ? existing.shown
    : [...existing.shown, suggestionId];
  const pending = existing.pending.filter((id) => id !== suggestionId);

  await db
    .insert(visitorSuggestionState)
    .values({
      organization_id: input.organizationId,
      visitor_id: visitorId,
      page_path: pagePath,
      section_key: sectionKey,
      shown_suggestion_ids: shown,
      pending_suggestion_ids: pending,
      total_suggestions_for_section: Math.max(existing.total, shown.length),
      updated_at: sql`now()`,
    })
    .onConflictDoUpdate({
      target: [
        visitorSuggestionState.organization_id,
        visitorSuggestionState.visitor_id,
        visitorSuggestionState.page_path,
        visitorSuggestionState.section_key,
      ],
      set: {
        shown_suggestion_ids: shown,
        pending_suggestion_ids: pending,
        total_suggestions_for_section: Math.max(existing.total, shown.length),
        updated_at: sql`now()`,
      },
    });

  return {
    shown,
    pending,
    total: Math.max(existing.total, shown.length),
  };
}
