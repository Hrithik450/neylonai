/**
 * Read-only relational SQL tool — patterned after email-assistant's
 * relational_query_tool (SELECT/WITH only, statement wrapping, markdown rows).
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import pg from "pg";
import { resolveDatabaseConnectionUrl } from "@neylonai/domain/integrations";
import {
  DATABASE_STATEMENT_TIMEOUT_SECONDS,
  getWorkloadBudget,
  workloadClassOrDefault,
} from "@neylonai/domain/billing";
import {
  getAgentTurnContext,
  recordDatabaseRows,
} from "../agent-turn-context";

const FORBIDDEN =
  /\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|COPY|EXECUTE|CALL|DO|MERGE|VACUUM|COMMENT|PREPARE|LISTEN|NOTIFY|LOAD|REINDEX|CLUSTER|REFRESH|SET|PG_READ_FILE|PG_READ_BINARY_FILE|PG_LS_DIR|PG_STAT_FILE|LO_IMPORT|LO_EXPORT|LO_GET|LO_PUT|LO_UNLINK|PG_SLEEP|DBLINK|PG_TERMINATE_BACKEND|PG_CANCEL_BACKEND)\b/i;

const ALLOWED_START = /^\s*(SELECT|WITH)\b/i;
const HAS_SEMICOLON = /;/;
const DEFAULT_ROWS = 20;

function rowCapForTurn(): number {
  const billing = getAgentTurnContext().billing;
  const klass = workloadClassOrDefault(
    billing?.workloadClass ?? billing?.estimate?.estimatedClass ?? "standard",
  );
  return getWorkloadBudget(klass).databaseRows;
}

function validateQuery(query: string): string | null {
  const stripped = query.replace(/;+\s*$/g, "").trim();
  if (!ALLOWED_START.test(stripped)) {
    return "Only SELECT or WITH (CTE) queries are allowed.";
  }
  if (HAS_SEMICOLON.test(stripped)) {
    return "Multiple statements (semicolons) are not allowed.";
  }
  if (FORBIDDEN.test(stripped)) {
    return "Query contains a forbidden keyword or function.";
  }
  return null;
}

function rowsToMarkdown(
  columns: string[],
  rows: unknown[][],
): string {
  if (rows.length === 0) return "_No rows returned._";
  const header = columns.join(" | ");
  const sep = columns.map(() => "---").join(" | ");
  const body = rows
    .map((row) =>
      row.map((v) => (v == null ? "NULL" : String(v))).join(" | "),
    )
    .join("\n");
  return `| ${header} |\n| ${sep} |\n${body
    .split("\n")
    .map((r) => `| ${r} |`)
    .join("\n")}`;
}

export const relationalQueryTool = tool(
  async ({
    query,
    limit = DEFAULT_ROWS,
  }: {
    query: string;
    limit?: number;
  }) => {
    const organizationId = getAgentTurnContext().organizationId?.trim();
    if (!organizationId) {
      return "Database tool unavailable (missing organization context).";
    }

    const connectionUrl = await resolveDatabaseConnectionUrl(organizationId);
    if (!connectionUrl) {
      return "No read-only Database integration connected. Ask the workspace admin to connect Postgres under Integrations.";
    }

    const err = validateQuery(query);
    if (err) return `Query rejected: ${err}`;

    const maxRows = rowCapForTurn();
    const rowLimit = Math.max(1, Math.min(Number(limit) || DEFAULT_ROWS, maxRows));
    const stripped = query.replace(/;+\s*$/g, "").trim();
    const safeQuery = `SELECT * FROM (${stripped}) _q LIMIT ${rowLimit}`;

    const client = new pg.Client({
      connectionString: connectionUrl,
      connectionTimeoutMillis: 10_000,
    });

    try {
      await client.connect();
      await client.query("SET default_transaction_read_only = on");
      await client.query(
        `SET statement_timeout = '${DATABASE_STATEMENT_TIMEOUT_SECONDS}s'`,
      );
      await client.query("BEGIN READ ONLY");
      const result = await client.query(safeQuery);
      await client.query("COMMIT");
      const columns = result.fields.map((f) => f.name);
      const rows = result.rows.map((r) => columns.map((c) => r[c]));
      recordDatabaseRows(rows.length);
      const table = rowsToMarkdown(columns, rows);
      return `${table}\n\n_Showing ${rows.length} row(s) (limit=${rowLimit})._`;
    } catch (error) {
      console.warn("relational_query error:", error);
      return "Query error: the query could not be executed. Check syntax and table/column names. Prefer tables from the Database schema knowledge document.";
    } finally {
      await client.end().catch(() => undefined);
    }
  },
  {
    name: "relational_query",
    description:
      "Run a read-only SQL SELECT (or WITH …) against the organization's connected Postgres database. Use after semantic_search on the stored schema document. Never use DML/DDL. Prefer small result sets.",
    schema: z.object({
      query: z
        .string()
        .describe("SQL SELECT or WITH query (no semicolons / multiple statements)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe("Max rows to return (default 20; hard-capped by workload class)"),
    }),
  },
);
