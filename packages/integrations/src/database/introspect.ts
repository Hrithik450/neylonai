/**
 * Read-only Postgres schema introspection → markdown for knowledge ingest.
 */

import pg from "pg";

export type PostgresIntrospectResult = {
  host: string;
  database: string;
  schemaText: string;
  tableCount: number;
};

type ColRow = {
  table_schema: string;
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
};

type FkRow = {
  table_schema: string;
  table_name: string;
  column_name: string;
  foreign_table_schema: string;
  foreign_table_name: string;
  foreign_column_name: string;
};

export async function introspectPostgresSchema(
  connectionUrl: string,
): Promise<PostgresIntrospectResult> {
  const client = new pg.Client({
    connectionString: connectionUrl,
    connectionTimeoutMillis: 12_000,
  });

  try {
    await client.connect();
    await client.query("SET default_transaction_read_only = on");
    await client.query("SET statement_timeout = '20s'");
    await client.query("SET TRANSACTION READ ONLY");

    const cols = await client.query<ColRow>(`
      SELECT
        c.table_schema,
        c.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema
       AND t.table_name = c.table_name
      WHERE t.table_type = 'BASE TABLE'
        AND c.table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY c.table_schema, c.table_name, c.ordinal_position
    `);

    const fks = await client.query<FkRow>(`
      SELECT
        tc.table_schema,
        tc.table_name,
        kcu.column_name,
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY tc.table_schema, tc.table_name, kcu.column_name
    `);

    const byTable = new Map<string, ColRow[]>();
    for (const row of cols.rows) {
      const key = `${row.table_schema}.${row.table_name}`;
      const list = byTable.get(key) ?? [];
      list.push(row);
      byTable.set(key, list);
    }

    const fkByTable = new Map<string, FkRow[]>();
    for (const row of fks.rows) {
      const key = `${row.table_schema}.${row.table_name}`;
      const list = fkByTable.get(key) ?? [];
      list.push(row);
      fkByTable.set(key, list);
    }

    const host = (() => {
      try {
        return new URL(connectionUrl).hostname;
      } catch {
        return "postgres";
      }
    })();
    const database = client.database || "postgres";

    const lines: string[] = [
      `# Postgres schema (${host} / ${database})`,
      "",
      "Read-only schema snapshot for the support agent. Use relational_query for live SELECT queries against these tables.",
      "",
      "## Tables",
      "",
    ];

    for (const [tableKey, columns] of byTable) {
      lines.push(`### ${tableKey}`);
      lines.push("| column | type | nullable | default |");
      lines.push("| --- | --- | --- | --- |");
      for (const c of columns) {
        lines.push(
          `| ${c.column_name} | ${c.data_type} | ${c.is_nullable} | ${c.column_default ?? ""} |`,
        );
      }
      const rels = fkByTable.get(tableKey) ?? [];
      if (rels.length > 0) {
        lines.push("");
        lines.push("Foreign keys:");
        for (const fk of rels) {
          lines.push(
            `- ${fk.column_name} → ${fk.foreign_table_schema}.${fk.foreign_table_name}.${fk.foreign_column_name}`,
          );
        }
      }
      lines.push("");
    }

    if (byTable.size === 0) {
      throw new Error(
        "No tables visible. Check the read-only role has SELECT on the schema.",
      );
    }

    return {
      host,
      database,
      schemaText: lines.join("\n").slice(0, 400_000),
      tableCount: byTable.size,
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}
