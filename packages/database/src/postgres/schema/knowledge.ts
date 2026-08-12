import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  index,
  uniqueIndex,
  halfvec,
  customType,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { organizationIntegrations } from "./integrations";

/** Gemini `gemini-embedding-001` default width (free tier). */
export const KNOWLEDGE_EMBEDDING_DIMENSIONS = 3072;

/** Default embedding model for org-scoped knowledge. */
export const KNOWLEDGE_EMBEDDING_MODEL = "gemini-embedding-001";

/**
 * tsvector for keyword / BM25-like retrieval (PostgreSQL FTS).
 */
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

/**
 * Multi-tenant knowledge:
 *   organization
 *     → organization_integrations (1 row per catalog type; credentials + enabled)
 *       → knowledge_sources (exactly 1 source bag per org integration)
 *         → knowledge_documents (instances: e.g. each PDF / scraped page)
 *           → knowledge_chunks
 *
 * Disabling an org integration purges its source → documents → chunks.
 */

export const knowledgeSources = pgTable(
  "knowledge_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** FK → organization_integrations.id */
    organization_integration_id: uuid("organization_integration_id")
      .notNull()
      .references(() => organizationIntegrations.id, { onDelete: "cascade" }),
    /** Denormalized from organization_integrations.integration_type (kept in sync via DB trigger). */
    source_type: varchar("source_type", { length: 64 }).notNull(),
    /** Number of knowledge_documents under this source. */
    document_count: integer("document_count").notNull().default(0),
    last_synced_at: timestamp("last_synced_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("knowledge_sources_org_idx").on(t.organization_id),
    index("knowledge_sources_org_source_type_idx").on(
      t.organization_id,
      t.source_type,
    ),
    /** One source bag per org integration; instances are documents. */
    uniqueIndex("knowledge_sources_organization_integration_uidx").on(
      t.organization_integration_id,
    ),
    index("knowledge_sources_org_organization_integration_idx").on(
      t.organization_id,
      t.organization_integration_id,
    ),
  ],
);

export const knowledgeDocuments = pgTable(
  "knowledge_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** FK → knowledge_sources.id */
    source_id: uuid("source_id")
      .notNull()
      .references(() => knowledgeSources.id, { onDelete: "cascade" }),
    external_doc_id: varchar("external_doc_id", { length: 255 }).notNull(),
    name: text("name"),
    /** Original uploaded / scraped text before chunking. */
    raw_content: text("raw_content"),
    /** Number of knowledge_chunks under this document. */
    chunks_count: integer("chunks_count").notNull().default(0),
    /** Object storage key for uploaded files (e.g. PDF). */
    storage_key: text("storage_key"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("knowledge_documents_org_external_uidx").on(
      t.organization_id,
      t.external_doc_id,
    ),
    index("knowledge_documents_organization_id_idx").on(t.organization_id),
    index("knowledge_documents_source_id_idx").on(t.source_id),
  ],
);

export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    document_id: uuid("document_id")
      .notNull()
      .references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
    external_chunk_id: varchar("external_chunk_id", { length: 255 }).notNull(),
    chunk_index: integer("chunk_index").notNull().default(0),
    content: text("content").notNull(),
    embedding: halfvec("embedding", {
      dimensions: KNOWLEDGE_EMBEDDING_DIMENSIONS,
    }).notNull(),
    content_tsv: tsvector("content_tsv"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("knowledge_chunks_org_external_uidx").on(
      t.organization_id,
      t.external_chunk_id,
    ),
    index("knowledge_chunks_organization_id_idx").on(t.organization_id),
    index("knowledge_chunks_document_id_idx").on(t.document_id),
    /** Single global HNSW index — revisit per-tenant partitioning only if insert latency or recall issues appear at scale. */
    index("knowledge_chunks_embedding_hnsw_idx")
      .using("hnsw", t.embedding.op("halfvec_cosine_ops"))
      .with({ m: 16, ef_construction: 64 }),
    index("knowledge_chunks_content_tsv_gin_idx").using("gin", t.content_tsv),
  ],
);

export function toHalfvecLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

export const knowledgeChunkSelectCols = {
  id: knowledgeChunks.id,
  content: knowledgeChunks.content,
  document_id: knowledgeChunks.document_id,
  external_chunk_id: knowledgeChunks.external_chunk_id,
};

export const knowledgeSourceAgents = pgTable(
  "knowledge_source_agents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    source_id: uuid("source_id")
      .notNull()
      .references(() => knowledgeSources.id, { onDelete: "cascade" }),
    agent_id: varchar("agent_id", { length: 64 }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("knowledge_source_agents_uidx").on(
      t.organization_id,
      t.source_id,
      t.agent_id,
    ),
    index("knowledge_source_agents_org_idx").on(t.organization_id),
    index("knowledge_source_agents_agent_idx").on(
      t.organization_id,
      t.agent_id,
    ),
  ],
);
