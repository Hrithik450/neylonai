CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_bases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"embedding_model" varchar(100) DEFAULT 'text-embedding-3-large' NOT NULL,
	"embedding_dimensions" integer DEFAULT 3072 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"knowledge_base_id" uuid NOT NULL,
	"external_doc_id" varchar(255) NOT NULL,
	"title" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"knowledge_base_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"external_chunk_id" varchar(255) NOT NULL,
	"chunk_index" integer DEFAULT 0 NOT NULL,
	"content" text NOT NULL,
	"embedding" halfvec(3072) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"content_tsv" tsvector,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "knowledge_bases" ADD CONSTRAINT "knowledge_bases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_knowledge_base_id_knowledge_bases_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_bases"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_knowledge_base_id_knowledge_bases_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_bases"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_knowledge_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."knowledge_documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_uidx" ON "organizations" USING btree ("slug");
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_bases_org_slug_uidx" ON "knowledge_bases" USING btree ("organization_id","slug");
--> statement-breakpoint
CREATE INDEX "knowledge_bases_organization_id_idx" ON "knowledge_bases" USING btree ("organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_documents_kb_external_uidx" ON "knowledge_documents" USING btree ("knowledge_base_id","external_doc_id");
--> statement-breakpoint
CREATE INDEX "knowledge_documents_organization_id_idx" ON "knowledge_documents" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "knowledge_documents_knowledge_base_id_idx" ON "knowledge_documents" USING btree ("knowledge_base_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_chunks_kb_external_uidx" ON "knowledge_chunks" USING btree ("knowledge_base_id","external_chunk_id");
--> statement-breakpoint
CREATE INDEX "knowledge_chunks_organization_id_idx" ON "knowledge_chunks" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "knowledge_chunks_knowledge_base_id_idx" ON "knowledge_chunks" USING btree ("knowledge_base_id");
--> statement-breakpoint
CREATE INDEX "knowledge_chunks_document_id_idx" ON "knowledge_chunks" USING btree ("document_id");
--> statement-breakpoint
CREATE INDEX "knowledge_chunks_embedding_hnsw_idx" ON "knowledge_chunks" USING hnsw ("embedding" halfvec_cosine_ops) WITH (m=16,ef_construction=64);
--> statement-breakpoint
CREATE INDEX "knowledge_chunks_content_tsv_gin_idx" ON "knowledge_chunks" USING gin ("content_tsv");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION knowledge_chunks_content_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW.content_tsv := to_tsvector('english', coalesce(NEW.content, ''));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER knowledge_chunks_content_tsv_update
BEFORE INSERT OR UPDATE OF content ON knowledge_chunks
FOR EACH ROW EXECUTE FUNCTION knowledge_chunks_content_tsv_trigger();
