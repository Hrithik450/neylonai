/**
 * Create tables if missing (billing may already exist from drizzle push).
 */
CREATE TABLE IF NOT EXISTS "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(32) DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
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
CREATE TABLE IF NOT EXISTS "api_keys" (
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
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "payment_provider" varchar(32);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "allowed_origins" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usage_events" (
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
CREATE TABLE IF NOT EXISTS "organization_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"agent_id" varchar(64) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_integrations" (
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
CREATE TABLE IF NOT EXISTS "billing_events" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "organization_members_org_user_uidx" ON "organization_members" ("organization_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_user_id_idx" ON "organization_members" ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_organization_uidx" ON "subscriptions" ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_status_idx" ON "subscriptions" ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_prefix_uidx" ON "api_keys" ("key_prefix");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_organization_id_idx" ON "api_keys" ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_events_org_created_idx" ON "usage_events" ("organization_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_events_org_kind_idx" ON "usage_events" ("organization_id","kind");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organization_agents_org_agent_uidx" ON "organization_agents" ("organization_id","agent_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organization_integrations_org_int_uidx" ON "organization_integrations" ("organization_id","integration_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_events_org_created_idx" ON "billing_events" ("organization_id","created_at");
