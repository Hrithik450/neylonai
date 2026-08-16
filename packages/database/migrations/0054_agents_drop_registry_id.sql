-- Drop agents.config.registryId — navigable id is agents.id (UUID) only.
-- Code registry matching uses role/name; Main Agent is config.role = 'main'.

UPDATE "agents"
SET "config" = COALESCE("config", '{}'::jsonb) - 'registryId'
WHERE "config" ? 'registryId';
