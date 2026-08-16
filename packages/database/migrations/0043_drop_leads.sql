-- Drop leads feature (table + legacy org agent rows). Reintroduce later if needed.
DELETE FROM "organization_agents" WHERE "agent_id" = 'lead';

DROP TABLE IF EXISTS "leads";
