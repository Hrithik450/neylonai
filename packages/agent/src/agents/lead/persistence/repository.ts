import { db, schema } from "@neylonai/database";
import { desc, eq, or } from "drizzle-orm";
import type { LeadInput, LeadRecord } from "./types";

const { leads } = schema;

function mapLead(row: typeof leads.$inferSelect): LeadRecord {
  return {
    id: row.id,
    organization_id: row.organization_id ?? null,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    budget: row.budget,
    timeline: row.timeline,
    thread_id: row.thread_id ?? null,
    status: row.status ?? "new",
    source_agent_id: row.source_agent_id ?? null,
    crm_sync_status: row.crm_sync_status ?? "not_configured",
    created_at: row.created_at?.toISOString() ?? null,
    updated_at: row.updated_at?.toISOString() ?? null,
  };
}

/** Persistence for Lead Agent–owned leads. Schema lives in @neylonai/database. */
export class LeadsRepository {
  static async upsertLead(
    input: LeadInput,
    threadId?: string,
  ): Promise<{ id: string; created: boolean }> {
    const rawOrgId = input.organization_id;
    if (!rawOrgId?.trim()) {
      throw new Error("organization_id is required to capture a lead");
    }
    const organizationId = rawOrgId.trim();

    const effectiveThreadId = input.thread_id ?? threadId ?? null;

    const hasIdentifier = input.email || effectiveThreadId;
    if (!hasIdentifier) {
      const [row] = await db
        .insert(leads)
        .values({
          organization_id: organizationId,
          name: input.name ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          company: input.company ?? null,
          budget: input.budget ?? null,
          timeline: input.timeline ?? null,
          thread_id: effectiveThreadId ? effectiveThreadId : undefined,
          status: input.status ?? "new",
          source_agent_id: input.source_agent_id ?? "lead",
          crm_sync_status: "not_configured",
        })
        .returning({ id: leads.id });
      return { id: row.id, created: true };
    }

    const conditions = [];
    if (input.email) conditions.push(eq(leads.email, input.email));
    if (effectiveThreadId)
      conditions.push(eq(leads.thread_id, effectiveThreadId));

    const existing = await db
      .select({ id: leads.id })
      .from(leads)
      .where(conditions.length === 1 ? conditions[0] : or(...conditions))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(leads)
        .set({
          organization_id: input.organization_id ?? undefined,
          name: input.name ?? undefined,
          email: input.email ?? undefined,
          phone: input.phone ?? undefined,
          company: input.company ?? undefined,
          budget: input.budget ?? undefined,
          timeline: input.timeline ?? undefined,
          source_agent_id: input.source_agent_id ?? undefined,
          status: input.status ?? undefined,
          updated_at: new Date(),
        })
        .where(eq(leads.id, existing[0].id));
      return { id: existing[0].id, created: false };
    }

    const [row] = await db
      .insert(leads)
      .values({
        organization_id: organizationId,
        name: input.name ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        company: input.company ?? null,
        budget: input.budget ?? null,
        timeline: input.timeline ?? null,
        thread_id: effectiveThreadId ? effectiveThreadId : undefined,
        status: input.status ?? "new",
        source_agent_id: input.source_agent_id ?? "lead",
        crm_sync_status: "not_configured",
      })
      .returning({ id: leads.id });
    return { id: row.id, created: true };
  }

  static async listLeadsForOrg(
    organizationId: string,
    limit = 100,
  ): Promise<LeadRecord[]> {
    const rows = await db
      .select()
      .from(leads)
      .where(eq(leads.organization_id, organizationId))
      .orderBy(desc(leads.created_at))
      .limit(limit);
    return rows.map(mapLead);
  }

  static async getLeadById(id: string): Promise<LeadRecord | null> {
    const [row] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, id))
      .limit(1);
    return row ? mapLead(row) : null;
  }
}
