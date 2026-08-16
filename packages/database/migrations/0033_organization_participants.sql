-- Org-scoped widget participants (identified + anonymous). Replaces global visitors.

CREATE TABLE IF NOT EXISTS "organization_participants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "display_name" varchar(255) NOT NULL DEFAULT 'Guest',
  "email" varchar(254),
  "profile_image" text,
  "is_anonymous" boolean NOT NULL DEFAULT true,
  "traits" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "last_seen_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

ALTER TABLE "organization_participants"
  ADD CONSTRAINT "organization_participants_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint

ALTER TABLE "organization_participants"
  VALIDATE CONSTRAINT "organization_participants_organization_id_organizations_id_fk";
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "organization_participants_org_external_uidx"
  ON "organization_participants" ("organization_id", "external_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "organization_participants_org_last_seen_idx"
  ON "organization_participants" ("organization_id", "last_seen_at" DESC);
--> statement-breakpoint

-- Migrate existing visitors → org-scoped participants (one row per org + visitor uuid)
INSERT INTO "organization_participants" (
  "organization_id",
  "external_id",
  "display_name",
  "is_anonymous",
  "created_at",
  "updated_at",
  "last_seen_at"
)
SELECT DISTINCT
  cs."organization_id",
  v."id"::text,
  v."display_name",
  true,
  v."created_at",
  v."updated_at",
  v."updated_at"
FROM "visitors" v
INNER JOIN "threads" t ON t."visitor_id" = v."id"
INNER JOIN "conversation_states" cs ON cs."thread_id" = t."id"
ON CONFLICT ("organization_id", "external_id") DO NOTHING;
--> statement-breakpoint

ALTER TABLE "threads" ADD COLUMN IF NOT EXISTS "participant_id" uuid;
--> statement-breakpoint

UPDATE "threads" t
SET "participant_id" = op."id"
FROM "conversation_states" cs
INNER JOIN "organization_participants" op
  ON op."organization_id" = cs."organization_id"
WHERE cs."thread_id" = t."id"
  AND t."participant_id" IS NULL
  AND t."visitor_id" IS NOT NULL
  AND op."external_id" = t."visitor_id"::text;
--> statement-breakpoint

-- Safety backfill: any thread/org pairs missed by the first insert
INSERT INTO "organization_participants" (
  "organization_id",
  "external_id",
  "display_name",
  "is_anonymous",
  "created_at",
  "updated_at",
  "last_seen_at"
)
SELECT DISTINCT
  cs."organization_id",
  t."visitor_id"::text,
  COALESCE(v."display_name", 'Guest'),
  true,
  COALESCE(v."created_at", now()),
  COALESCE(v."updated_at", now()),
  COALESCE(v."updated_at", now())
FROM "threads" t
INNER JOIN "conversation_states" cs ON cs."thread_id" = t."id"
LEFT JOIN "visitors" v ON v."id" = t."visitor_id"
WHERE t."visitor_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "organization_participants" op
    WHERE op."organization_id" = cs."organization_id"
      AND op."external_id" = t."visitor_id"::text
  )
ON CONFLICT ("organization_id", "external_id") DO NOTHING;
--> statement-breakpoint

UPDATE "threads" t
SET "participant_id" = op."id"
FROM "conversation_states" cs
INNER JOIN "organization_participants" op
  ON op."organization_id" = cs."organization_id"
WHERE cs."thread_id" = t."id"
  AND t."participant_id" IS NULL
  AND t."visitor_id" IS NOT NULL
  AND op."external_id" = t."visitor_id"::text;
--> statement-breakpoint

ALTER TABLE "threads" DROP CONSTRAINT IF EXISTS "threads_visitor_id_visitors_id_fk";
--> statement-breakpoint

DROP INDEX IF EXISTS "threads_visitor_id_idx";
--> statement-breakpoint

ALTER TABLE "threads" DROP COLUMN IF EXISTS "visitor_id";
--> statement-breakpoint

ALTER TABLE "threads"
  ADD CONSTRAINT "threads_participant_id_organization_participants_id_fk"
  FOREIGN KEY ("participant_id") REFERENCES "public"."organization_participants"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID;
--> statement-breakpoint

ALTER TABLE "threads" VALIDATE CONSTRAINT "threads_participant_id_organization_participants_id_fk";
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "threads_participant_id_idx" ON "threads" ("participant_id");
--> statement-breakpoint

DROP TABLE IF EXISTS "visitors";
