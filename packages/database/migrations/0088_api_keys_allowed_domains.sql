-- api_keys: allowed_domains holds the per-key domain allowlist configured in the
-- dashboard (Settings → API keys) and enforced server-side in authenticateApiKey.
-- History: shipped as allowed_origins (0002), dropped as unused in 0075 when CORS
-- moved to the app layer, then reintroduced under the name allowed_domains in the
-- Drizzle schema — but no migration ever re-added the column, so the live table
-- lacked it and every api_keys read failed once the code started selecting it.
-- Default '[]' = empty allowlist = unrestricted, so existing keys keep working
-- until an org opts in to restricting domains.
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "allowed_domains" jsonb DEFAULT '[]'::jsonb;
