-- Purge tenant-scoped rows left behind by deleted organizations and restore the
-- cascade foreign keys that were missing, so admin counters stop reporting
-- phantom agents and integrations from organizations that no longer exist.

DO $$
DECLARE
  t text;
  -- Children first: rows are removed before the tables they point at.
  tables text[] := ARRAY[
    'knowledge_chunks',
    'knowledge_source_agents',
    'knowledge_documents',
    'knowledge_sources',
    'website_crawl_pages',
    'website_crawl_jobs',
    'website_crawl_budget_months',
    'message_citations',
    'message_feedback',
    'knowledge_gap_events',
    'proactive_trigger_events',
    'organization_integration_secrets',
    'organization_integrations',
    'usage_request_reservations',
    'usage_class_period_counters',
    'credit_ledger',
    'usage_request_rollups',
    'billing_events',
    'product_usage_events',
    'usage_events',
    'api_keys',
    'subscriptions',
    'organization_agents',
    'organization_accounts',
    'organization_settings',
    'widget_configs',
    'organization_fonts',
    'organization_logos',
    'threads',
    'organization_participants'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'DELETE FROM %1$I WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = %1$I.organization_id)',
      t
    );

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attrelid = c.conrelid
       AND a.attnum = ANY (c.conkey)
      WHERE c.conrelid = t::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'organizations'::regclass
        AND a.attname = 'organization_id'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE',
        t,
        t || '_organization_id_organizations_id_fk'
      );
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint

DELETE FROM "organization_integrations"
WHERE "integration_id" NOT IN (
  'website',
  'database',
  'web_search',
  'whatsapp',
  'calcom'
);
--> statement-breakpoint

DELETE FROM "organization_agents"
WHERE "agent_key" <> 'main-agent';
