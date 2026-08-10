CREATE TABLE IF NOT EXISTS "organization_fonts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "family_name" varchar(120) NOT NULL,
  "original_filename" varchar(255) NOT NULL,
  "content_type" varchar(120) NOT NULL,
  "byte_size" integer NOT NULL,
  "storage_key" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "organization_fonts" ADD CONSTRAINT "organization_fonts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_fonts_org_idx" ON "organization_fonts" USING btree ("organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organization_fonts_org_id_uidx" ON "organization_fonts" USING btree ("organization_id","id");
