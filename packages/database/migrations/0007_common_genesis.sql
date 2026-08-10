CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(120) DEFAULT 'Default' NOT NULL,
	"key_prefix" varchar(16) NOT NULL,
	"key_hash" text NOT NULL,
	"last_four" varchar(4) NOT NULL,
	"allowed_origins" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "billing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"subscription_id" uuid,
	"provider" varchar(32) NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"external_id" varchar(255),
	"amount_cents" integer,
	"currency" varchar(8) DEFAULT 'usd',
	"payload" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversation_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"status" varchar(32) DEFAULT 'ai_active' NOT NULL,
	"assigned_agent_id" varchar(64),
	"assigned_human_id" uuid,
	"assigned_team" varchar(120),
	"escalation_reason" text,
	"escalation_trigger" varchar(64),
	"escalated_at" timestamp with time zone,
	"escalated_by_agent_id" varchar(64),
	"lead_id" uuid,
	"ticket_id" uuid,
	"conversation_summary" text,
	"handoff_history" jsonb DEFAULT '[]'::jsonb,
	"ai_paused" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_bases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"embedding_model" varchar(100) DEFAULT 'gemini-embedding-001' NOT NULL,
	"embedding_dimensions" integer DEFAULT 3072 NOT NULL,
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
	"content_tsv" "tsvector",
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
	"source_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_source_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"agent_id" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"knowledge_base_id" uuid,
	"type" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" varchar(32) DEFAULT 'processing' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"content_count" integer DEFAULT 0 NOT NULL,
	"page_count" integer DEFAULT 0 NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organization_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"agent_id" varchar(64) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organization_engagement_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lead_agent_enabled" boolean DEFAULT true NOT NULL,
	"lead_fields" jsonb DEFAULT '["name","email","company"]'::jsonb NOT NULL,
	"human_handoff_enabled" boolean DEFAULT true NOT NULL,
	"escalation_conditions" jsonb DEFAULT '{"explicitHumanRequest":true,"repeatedUnhelpful":true,"frustration":true,"lowConfidence":true,"businessRules":true}'::jsonb NOT NULL,
	"default_team" varchar(120) DEFAULT 'support',
	"availability_mode" varchar(32) DEFAULT 'collect_contact' NOT NULL,
	"business_hours_note" text DEFAULT 'Our team typically replies within one business day.',
	"customer_handoff_message" text DEFAULT 'I’m connecting you with a teammate who can help further. Hang tight — they’ll pick this up shortly.',
	"unavailable_message" text DEFAULT 'Our team isn’t immediately available right now. Share the best way to reach you and we’ll follow up soon.',
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organization_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"integration_id" varchar(64) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"status" varchar(32) DEFAULT 'disconnected' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organization_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" varchar(254) NOT NULL,
	"role" varchar(32) DEFAULT 'member' NOT NULL,
	"invited_by_user_id" uuid,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(32) DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organization_workspace_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"customer_facing_name" varchar(255),
	"logo_url" text,
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"default_language" varchar(16) DEFAULT 'en' NOT NULL,
	"notifications" jsonb DEFAULT '{"humanHandoffEmail":true,"humanHandoffSlack":true,"ticketEmail":true,"ticketSlack":true,"leadEmail":true,"leadSlack":false}'::jsonb NOT NULL,
	"privacy" jsonb DEFAULT '{"conversationRetentionDays":365,"allowDataExport":true,"anonymizeVisitorIds":false}'::jsonb NOT NULL,
	"sso" jsonb DEFAULT '{"enabled":false,"provider":null,"notes":null}'::jsonb NOT NULL,
	"webhook_url" text,
	"webhook_secret_last_four" varchar(4),
	"webhook_secret_hash" text,
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"plan" varchar(64) DEFAULT 'free' NOT NULL,
	"monthly_request_limit" integer,
	"current_period_start" timestamp with time zone DEFAULT now(),
	"current_period_end" timestamp with time zone,
	"payment_provider" varchar(32),
	"external_customer_id" varchar(255),
	"external_subscription_id" varchar(255),
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"status" varchar(32) DEFAULT 'open' NOT NULL,
	"assigned_human_id" uuid,
	"assigned_team" varchar(120),
	"agent_id" varchar(64),
	"agent_name" varchar(120),
	"escalation_reason" text,
	"escalation_trigger" varchar(64),
	"page_path" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"context_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resolved_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"api_key_id" uuid,
	"kind" varchar(64) NOT NULL,
	"model" varchar(120),
	"input_tokens" integer DEFAULT 0,
	"output_tokens" integer DEFAULT 0,
	"estimated_cost_micros" bigint DEFAULT 0,
	"agent_id" varchar(64),
	"integration_id" varchar(64),
	"thread_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "widget_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "status" varchar(32) DEFAULT 'new';--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "source_agent_id" varchar(64);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "crm_sync_status" varchar(32) DEFAULT 'not_configured';--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_states" ADD CONSTRAINT "conversation_states_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_bases" ADD CONSTRAINT "knowledge_bases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_knowledge_base_id_knowledge_bases_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_bases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_knowledge_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."knowledge_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_knowledge_base_id_knowledge_bases_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_bases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_source_agents" ADD CONSTRAINT "knowledge_source_agents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_source_agents" ADD CONSTRAINT "knowledge_source_agents_source_id_knowledge_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."knowledge_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_knowledge_base_id_knowledge_bases_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_bases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_agents" ADD CONSTRAINT "organization_agents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_engagement_settings" ADD CONSTRAINT "organization_engagement_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_integrations" ADD CONSTRAINT "organization_integrations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_workspace_settings" ADD CONSTRAINT "organization_workspace_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "widget_configs" ADD CONSTRAINT "widget_configs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_prefix_uidx" ON "api_keys" USING btree ("key_prefix");--> statement-breakpoint
CREATE INDEX "api_keys_organization_id_idx" ON "api_keys" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "billing_events_org_created_idx" ON "billing_events" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_states_thread_uidx" ON "conversation_states" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "conversation_states_org_status_idx" ON "conversation_states" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_bases_org_slug_uidx" ON "knowledge_bases" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "knowledge_bases_organization_id_idx" ON "knowledge_bases" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_chunks_kb_external_uidx" ON "knowledge_chunks" USING btree ("knowledge_base_id","external_chunk_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_organization_id_idx" ON "knowledge_chunks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_knowledge_base_id_idx" ON "knowledge_chunks" USING btree ("knowledge_base_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_document_id_idx" ON "knowledge_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_embedding_hnsw_idx" ON "knowledge_chunks" USING hnsw ("embedding" halfvec_cosine_ops) WITH (m=16,ef_construction=64);--> statement-breakpoint
CREATE INDEX "knowledge_chunks_content_tsv_gin_idx" ON "knowledge_chunks" USING gin ("content_tsv");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_documents_kb_external_uidx" ON "knowledge_documents" USING btree ("knowledge_base_id","external_doc_id");--> statement-breakpoint
CREATE INDEX "knowledge_documents_organization_id_idx" ON "knowledge_documents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "knowledge_documents_knowledge_base_id_idx" ON "knowledge_documents" USING btree ("knowledge_base_id");--> statement-breakpoint
CREATE INDEX "knowledge_documents_source_id_idx" ON "knowledge_documents" USING btree ("source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_source_agents_uidx" ON "knowledge_source_agents" USING btree ("organization_id","source_id","agent_id");--> statement-breakpoint
CREATE INDEX "knowledge_source_agents_org_idx" ON "knowledge_source_agents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "knowledge_source_agents_agent_idx" ON "knowledge_source_agents" USING btree ("organization_id","agent_id");--> statement-breakpoint
CREATE INDEX "knowledge_sources_org_idx" ON "knowledge_sources" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "knowledge_sources_org_status_idx" ON "knowledge_sources" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "knowledge_sources_type_idx" ON "knowledge_sources" USING btree ("organization_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_agents_org_agent_uidx" ON "organization_agents" USING btree ("organization_id","agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_engagement_settings_org_uidx" ON "organization_engagement_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_integrations_org_int_uidx" ON "organization_integrations" USING btree ("organization_id","integration_id");--> statement-breakpoint
CREATE INDEX "organization_invites_org_idx" ON "organization_invites" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_invites_email_idx" ON "organization_invites" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_members_org_user_uidx" ON "organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "organization_members_user_id_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_workspace_settings_org_uidx" ON "organization_workspace_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_uidx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_organization_uidx" ON "subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tickets_org_status_idx" ON "tickets" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "tickets_thread_idx" ON "tickets" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "usage_events_org_created_idx" ON "usage_events" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "usage_events_org_kind_idx" ON "usage_events" USING btree ("organization_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "widget_configs_organization_uidx" ON "widget_configs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "leads_organization_id_idx" ON "leads" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "leads_thread_id_idx" ON "leads" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "thread_messages_thread_id_idx" ON "thread_messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "thread_user_id_idx" ON "thread" USING btree ("user_id");