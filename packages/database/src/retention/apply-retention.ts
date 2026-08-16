import { sql } from "drizzle-orm";
import { db } from "../postgres/client";
import { organizationSettings } from "../postgres/schema/organizations";

export type RetentionTableResult = {
  tableName: string;
  rowsDeleted: number;
};

export type RetentionRunResult = {
  organizationId: string;
  retentionDays: number | null;
  tables: RetentionTableResult[];
  totalDeleted: number;
};

type PrivacyRow = {
  organization_id: string;
  privacy: {
    conversationRetentionDays?: number | null;
  } | null;
};

const RETENTION_FUNCTIONS = {
  thread_messages: "purge_thread_messages_for_org",
  usage_events: "purge_usage_events_for_org",
  product_usage_events: "purge_product_usage_events_for_org",
  billing_events: "purge_billing_events_for_org",
} as const;

type RetentionTable = keyof typeof RETENTION_FUNCTIONS;

async function purgeTable(
  organizationId: string,
  tableName: RetentionTable,
  cutoffIso: string,
): Promise<number> {
  const fn = RETENTION_FUNCTIONS[tableName];
  const result = await db.execute<{ purge: string }>(sql`
    SELECT ${sql.raw(fn)}(
      ${organizationId}::uuid,
      ${cutoffIso}::timestamptz
    ) AS purge
  `);
  const row = Array.isArray(result)
    ? result[0]
    : ((result as { rows?: { purge: string }[] }).rows?.[0] ?? null);
  return Number(row?.purge ?? 0);
}

/**
 * Apply workspace privacy retention for one organization.
 * Uses batched DELETE functions defined in migration 0032 (partition-ready).
 */
export async function applyRetentionForOrganization(
  organizationId: string,
  retentionDays: number | null,
): Promise<RetentionRunResult> {
  const tables: RetentionTableResult[] = [];

  if (!retentionDays || retentionDays <= 0) {
    return {
      organizationId,
      retentionDays,
      tables,
      totalDeleted: 0,
    };
  }

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  const cutoffIso = cutoff.toISOString();

  for (const tableName of Object.keys(RETENTION_FUNCTIONS) as RetentionTable[]) {
    const startedAt = new Date();
    const rowsDeleted = await purgeTable(organizationId, tableName, cutoffIso);

    await db.execute(sql`
      INSERT INTO retention_runs (
        organization_id,
        table_name,
        rows_deleted,
        retention_days,
        started_at,
        finished_at
      ) VALUES (
        ${organizationId}::uuid,
        ${tableName},
        ${rowsDeleted},
        ${retentionDays},
        ${startedAt.toISOString()}::timestamptz,
        ${new Date().toISOString()}::timestamptz
      )
    `);

    tables.push({ tableName, rowsDeleted });
  }

  const totalDeleted = tables.reduce((sum, t) => sum + t.rowsDeleted, 0);
  return { organizationId, retentionDays, tables, totalDeleted };
}

/** Run retention for every org with a finite conversationRetentionDays policy. */
export async function applyRetentionForAllOrganizations(): Promise<
  RetentionRunResult[]
> {
  const rows = await db
    .select({
      organization_id: organizationSettings.organization_id,
      privacy: organizationSettings.privacy,
    })
    .from(organizationSettings);

  const results: RetentionRunResult[] = [];

  for (const row of rows as PrivacyRow[]) {
    const days = row.privacy?.conversationRetentionDays ?? null;
    if (days == null || days <= 0) continue;
    results.push(
      await applyRetentionForOrganization(row.organization_id, days),
    );
  }

  return results;
}
