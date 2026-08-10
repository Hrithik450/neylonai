-- Resource metering redesign (provider COGS).
-- Preserve incomplete historical rows; do not fabricate provider/model/units.

ALTER TABLE "usage_events" RENAME TO "usage_events_legacy";
--> statement-breakpoint
ALTER INDEX IF EXISTS "usage_events_org_created_idx" RENAME TO "usage_events_legacy_org_created_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "usage_events_org_kind_idx" RENAME TO "usage_events_legacy_org_kind_idx";
--> statement-breakpoint

CREATE TABLE "usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"api_key_id" uuid,
	"request_id" varchar(64) NOT NULL,
	"thread_id" uuid,
	"agent_id" varchar(64),
	"resource_type" varchar(16) NOT NULL,
	"provider" varchar(64) NOT NULL,
	"service" varchar(120) NOT NULL,
	"operation" varchar(64),
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"quantity" numeric(20, 6) DEFAULT 0 NOT NULL,
	"unit" varchar(32) NOT NULL,
	"provider_cost_micros" bigint,
	"pricing_status" varchar(16) NOT NULL DEFAULT 'unknown',
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE "product_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"api_key_id" uuid,
	"metric" varchar(64) NOT NULL,
	"request_id" varchar(64),
	"thread_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint

ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_usage_events" ADD CONSTRAINT "product_usage_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_usage_events" ADD CONSTRAINT "product_usage_events_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX "usage_events_org_created_idx" ON "usage_events" USING btree ("organization_id","created_at");
--> statement-breakpoint
CREATE INDEX "usage_events_org_provider_idx" ON "usage_events" USING btree ("organization_id","provider");
--> statement-breakpoint
CREATE INDEX "usage_events_request_idx" ON "usage_events" USING btree ("request_id");
--> statement-breakpoint
CREATE INDEX "product_usage_events_org_metric_created_idx" ON "product_usage_events" USING btree ("organization_id","metric","created_at");
