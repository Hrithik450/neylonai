import { and, eq } from "drizzle-orm";
import { db, organizationAgents } from "@neylonai/database";
import {
  MAIN_AGENT_KEY,
  type OrgAgentRecord,
} from "./org-agents.types";

function asExtra(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function mapRow(
  row: typeof organizationAgents.$inferSelect,
): OrgAgentRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    agentKey: row.agent_key,
    enabled: row.enabled,
    extra: asExtra(row.extra),
    createdAt: row.created_at?.toISOString() ?? null,
  };
}

export class OrgAgentsService {
  static async list(organizationId: string): Promise<OrgAgentRecord[]> {
    const rows = await db
      .select()
      .from(organizationAgents)
      .where(eq(organizationAgents.organization_id, organizationId));
    return rows.map(mapRow);
  }

  static async get(
    organizationId: string,
    agentKey: string,
  ): Promise<OrgAgentRecord | null> {
    const [row] = await db
      .select()
      .from(organizationAgents)
      .where(
        and(
          eq(organizationAgents.organization_id, organizationId),
          eq(organizationAgents.agent_key, agentKey),
        ),
      )
      .limit(1);
    return row ? mapRow(row) : null;
  }

  static async ensureMainAgent(
    organizationId: string,
  ): Promise<OrgAgentRecord> {
    const existing = await this.get(organizationId, MAIN_AGENT_KEY);
    if (existing) {
      if (!existing.enabled) {
        return this.connect(organizationId, MAIN_AGENT_KEY, existing.extra);
      }
      return existing;
    }
    return this.connect(organizationId, MAIN_AGENT_KEY, {});
  }

  /** Connect / enable an agent for the org (upsert). */
  static async connect(
    organizationId: string,
    agentKey: string,
    extra?: Record<string, unknown>,
  ): Promise<OrgAgentRecord> {
    const [row] = await db
      .insert(organizationAgents)
      .values({
        organization_id: organizationId,
        agent_key: agentKey,
        enabled: true,
        extra: extra ?? {},
      })
      .onConflictDoUpdate({
        target: [
          organizationAgents.organization_id,
          organizationAgents.agent_key,
        ],
        set: {
          enabled: true,
          ...(extra !== undefined ? { extra } : {}),
        },
      })
      .returning();
    if (!row) throw new Error("Failed to connect agent");
    return mapRow(row);
  }

  /**
   * Disconnect specialized agent (delete row).
   * Main agent cannot be disconnected — only stays enabled.
   */
  static async disconnect(
    organizationId: string,
    agentKey: string,
  ): Promise<void> {
    if (agentKey === MAIN_AGENT_KEY) {
      throw new Error("Main Agent cannot be disconnected");
    }
    await db
      .delete(organizationAgents)
      .where(
        and(
          eq(organizationAgents.organization_id, organizationId),
          eq(organizationAgents.agent_key, agentKey),
        ),
      );
  }

  static async updateExtra(
    organizationId: string,
    agentKey: string,
    extra: Record<string, unknown>,
  ): Promise<OrgAgentRecord | null> {
    const [row] = await db
      .update(organizationAgents)
      .set({ extra })
      .where(
        and(
          eq(organizationAgents.organization_id, organizationId),
          eq(organizationAgents.agent_key, agentKey),
        ),
      )
      .returning();
    return row ? mapRow(row) : null;
  }
}
