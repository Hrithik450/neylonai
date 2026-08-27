-- api_keys.public_key stores the raw publishable key (nk_live_…) so the dashboard
-- can render and re-copy the exact install snippet (<script data-key=...>) on every
-- visit, without rotating the key. This is safe at rest: it is a *publishable*
-- client key that ships in the customer's page HTML (à la Stripe pk_live) — the
-- allowed_domains allowlist enforced in authenticateApiKey, not secrecy of this
-- value, is the security boundary. key_hash remains the authentication source of
-- truth. Nullable: keys created before this column keep public_key = NULL and must
-- be rotated (which mints a fresh key that populates it) to become copyable.
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "public_key" text;
