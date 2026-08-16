/**
 * Metadata-only organization workload summary for credit estimation.
 *
 * Never returns document text, integration config, credentials, user data,
 * or secrets. Counts + byte size of raw_content only.
 */

import { and, count, eq, sql } from "drizzle-orm";
import {
  db,
  knowledgeChunks,
  knowledgeDocuments,
  knowledgeSources,
  organizationIntegrations,
} from "@neylonai/database";
import { toolCostMicros } from "./pricing";

export const ORG_WORKLOAD_SUMMARY_KEYS = [
  "sourceCount",
  "documentCount",
  "chunkCount",
  "rawContentBytes",
  "enabledCapabilityIds",
] as const;

export type OrgWorkloadSummary = {
  sourceCount: number;
  documentCount: number;
  chunkCount: number;
  rawContentBytes: number;
  enabledCapabilityIds: string[];
};

export type ConversationWorkloadSnapshot = {
  messageCount: number;
  characterCount: number;
  queryCharacterCount: number;
};

export type ToolCostHint = {
  name: string;
  estimatedUsdPerCall: number | null;
  pricingStatus: "verified" | "unknown";
};

const FORBIDDEN_WORKLOAD_KEYS = [
  "raw_content",
  "rawContent",
  "content",
  "text",
  "config",
  "credentials",
  "secret",
  "secrets",
  "password",
  "apiKey",
  "api_key",
  "token",
  "email",
  "user",
  "users",
] as const;

const TOOL_PRICE_HINTS: Record<string, { toolId: string; operation: string }> =
  {
    web_search: { toolId: "tavily.search", operation: "basic" },
    scrape_url: { toolId: "firecrawl.scrape", operation: "page" },
  };

const CAPABILITY_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

export function emptyOrgWorkloadSummary(): OrgWorkloadSummary {
  return {
    sourceCount: 0,
    documentCount: 0,
    chunkCount: 0,
    rawContentBytes: 0,
    enabledCapabilityIds: [],
  };
}

function asNonNegativeInt(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function sanitizeCapabilityIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string") continue;
    const trimmed = id.trim();
    if (!CAPABILITY_ID_RE.test(trimmed)) continue;
    out.push(trimmed);
  }
  return [...new Set(out)].sort();
}

/** Keep only counts, byte size, and capability IDs. */
export function toSafeOrgWorkloadSummary(
  input:
    | Partial<OrgWorkloadSummary>
    | Record<string, unknown>
    | null
    | undefined,
): OrgWorkloadSummary {
  const raw = input && typeof input === "object" ? input : {};
  return {
    sourceCount: asNonNegativeInt(raw.sourceCount),
    documentCount: asNonNegativeInt(raw.documentCount),
    chunkCount: asNonNegativeInt(raw.chunkCount),
    rawContentBytes: asNonNegativeInt(raw.rawContentBytes),
    enabledCapabilityIds: sanitizeCapabilityIds(raw.enabledCapabilityIds),
  };
}

export function assertSafeOrgWorkloadSummary(
  summary: Record<string, unknown>,
): void {
  for (const key of Object.keys(summary)) {
    if (
      !(ORG_WORKLOAD_SUMMARY_KEYS as readonly string[]).includes(key) &&
      (FORBIDDEN_WORKLOAD_KEYS as readonly string[]).includes(key)
    ) {
      throw new Error(`Unsafe workload summary key: ${key}`);
    }
  }
  const serialized = JSON.stringify(summary).toLowerCase();
  for (const needle of ["sk-", "password", "-----begin", "api_key", "apikey"]) {
    if (serialized.includes(needle)) {
      throw new Error("Workload summary must not include secrets");
    }
  }
}

export function formatWorkloadBytes(bytes: number): string {
  const n = asNonNegativeInt(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) {
    const kb = n / 1024;
    return `${kb >= 10 ? kb.toFixed(0) : kb.toFixed(1)} KB`;
  }
  const mb = n / (1024 * 1024);
  return `${mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)} MB`;
}

export function snapshotConversationWorkload(
  messages: Array<{ content?: string | null }> | null | undefined,
  query: string,
): ConversationWorkloadSnapshot {
  const list = Array.isArray(messages) ? messages : [];
  let characterCount = 0;
  for (const message of list) {
    characterCount += (message.content ?? "").length;
  }
  return {
    messageCount: list.length,
    characterCount,
    queryCharacterCount: query.length,
  };
}

export function toolCostMetadata(toolNames: string[]): ToolCostHint[] {
  const unique = [...new Set(toolNames.filter(Boolean))];
  return unique.map((name) => {
    const hint = TOOL_PRICE_HINTS[name];
    if (!hint) {
      return {
        name,
        estimatedUsdPerCall: name === "semantic_search" ? 0 : null,
        pricingStatus: name === "semantic_search" ? "verified" : "unknown",
      };
    }
    const priced = toolCostMicros({
      toolId: hint.toolId,
      operation: hint.operation,
      quantity: 1,
    });
    return {
      name,
      estimatedUsdPerCall:
        priced.costMicros == null ? null : priced.costMicros / 1_000_000,
      pricingStatus: priced.pricingStatus,
    };
  });
}

export async function getOrgWorkloadSummary(
  organizationId: string,
): Promise<OrgWorkloadSummary> {
  if (!organizationId) return emptyOrgWorkloadSummary();

  try {
    const [sourceRows, documentRows, chunkRows, capabilityRows] = await Promise.all([
      db
        .select({ n: count() })
        .from(knowledgeSources)
        .where(eq(knowledgeSources.organization_id, organizationId)),
      db
        .select({
          n: count(),
          bytes: sql<number>`coalesce(sum(octet_length(${knowledgeDocuments.raw_content})), 0)::bigint`,
        })
        .from(knowledgeDocuments)
        .where(eq(knowledgeDocuments.organization_id, organizationId)),
      db
        .select({ n: count() })
        .from(knowledgeChunks)
        .where(eq(knowledgeChunks.organization_id, organizationId)),
      db
        .select({
          id: organizationIntegrations.integration_id,
        })
        .from(organizationIntegrations)
        .where(
          and(
            eq(organizationIntegrations.organization_id, organizationId),
            eq(organizationIntegrations.enabled, true),
          ),
        ),
    ]);

    return toSafeOrgWorkloadSummary({
      sourceCount: sourceRows[0]?.n ?? 0,
      documentCount: documentRows[0]?.n ?? 0,
      chunkCount: chunkRows[0]?.n ?? 0,
      rawContentBytes: documentRows[0]?.bytes ?? 0,
      enabledCapabilityIds: capabilityRows.map((row) => row.id),
    });
  } catch (error) {
    console.warn(
      "[credit-estimation] workload summary failed:",
      error instanceof Error ? error.message : error,
    );
    return emptyOrgWorkloadSummary();
  }
}
