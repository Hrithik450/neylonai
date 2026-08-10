CREATE TABLE IF NOT EXISTS "organization_logos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "original_filename" varchar(255) NOT NULL,
  "content_type" varchar(120) NOT NULL,
  "byte_size" integer NOT NULL,
  "storage_key" text NOT NULL,
  "public_url" text,
  "created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "organization_logos" ADD CONSTRAINT "organization_logos_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organization_logos_org_uidx" ON "organization_logos" USING btree ("organization_id");
