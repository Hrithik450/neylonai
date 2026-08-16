-- Rename Main Agent registry key: neylonai-chatbot → main-agent
UPDATE "organization_agents"
SET "agent_key" = 'main-agent'
WHERE "agent_key" = 'neylonai-chatbot';

UPDATE "knowledge_source_agents"
SET "agent_key" = 'main-agent'
WHERE "agent_key" = 'neylonai-chatbot';
