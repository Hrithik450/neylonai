import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
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
 *         → knowledge_documents (instances such as scraped pages or tables)
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
    last_synced_at: timestamp("last_synced_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("knowledge_sources_org_idx").on(t.organization_id),
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
    canonical_path: text("canonical_path"),
    /** Original uploaded / scraped text before chunking. */
    raw_content: text("raw_content"),
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
    uniqueIndex("knowledge_documents_source_canonical_path_uidx").on(
      t.source_id,
      t.canonical_path,
    ),
    index("knowledge_documents_org_canonical_path_idx").on(
      t.organization_id,
      t.canonical_path,
    ),
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

/** Page sections and their page-specific proactive prompts. */
export const knowledgePageSections = pgTable(
  "knowledge_page_sections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    document_id: uuid("document_id")
      .notNull()
      .references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
    section_key: varchar("section_key", { length: 96 }).notNull(),
    content: text("content").notNull(),
    /** Scraper that produced the source page for this section. */
    provider: varchar("provider", { length: 32 }).notNull().default("unknown"),
    /** Who produced the section split: gemini or heuristic. */
    sectioner: varchar("sectioner", { length: 32 })
      .notNull()
      .default("unknown"),
    suggestions: jsonb("suggestions").$type<string[]>().notNull().default([]),
    position: integer("position").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("knowledge_page_sections_document_key_uidx").on(
      t.document_id,
      t.section_key,
    ),
    index("knowledge_page_sections_org_document_idx").on(
      t.organization_id,
      t.document_id,
    ),
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
    agent_key: varchar("agent_key", { length: 64 }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("knowledge_source_agents_uidx").on(
      t.organization_id,
      t.source_id,
      t.agent_key,
    ),
    index("knowledge_source_agents_org_idx").on(t.organization_id),
    index("knowledge_source_agents_agent_idx").on(
      t.organization_id,
      t.agent_key,
    ),
  ],
);
