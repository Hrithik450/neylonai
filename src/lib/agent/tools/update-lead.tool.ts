import { tool } from "@langchain/core/tools";
import { db } from "@/lib/db";
import { leads } from "@/lib/drizzle/schema";
import { eq, and, or } from "drizzle-orm";
import { z } from "zod";

interface LeadInput {
  email?: string;
  phone?: string;
  company?: string;
  name?: string;
  budget?: string;
  timeline?: string;
  thread_id?: string;
}

async function upsertLead(input: LeadInput, threadId?: string): Promise<string> {
  try {
    const effectiveThreadId = input.thread_id ?? threadId ?? null;

    const hasIdentifier = input.email || effectiveThreadId;
    if (!hasIdentifier) {
      const [row] = await db
        .insert(leads)
        .values({
          name: input.name ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          company: input.company ?? null,
          budget: input.budget ?? null,
          timeline: input.timeline ?? null,
          thread_id: effectiveThreadId ? effectiveThreadId : undefined,
        })
        .returning({ id: leads.id });
      return `Lead created (id: ${row.id})`;
    }

    const conditions = [];
    if (input.email) conditions.push(eq(leads.email, input.email));
    if (effectiveThreadId) conditions.push(eq(leads.thread_id, effectiveThreadId));

    const existing = await db
      .select({ id: leads.id })
      .from(leads)
      .where(conditions.length === 1 ? conditions[0] : or(...conditions))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(leads)
        .set({
          name: input.name ?? undefined,
          email: input.email ?? undefined,
          phone: input.phone ?? undefined,
          company: input.company ?? undefined,
          budget: input.budget ?? undefined,
          timeline: input.timeline ?? undefined,
          updated_at: new Date(),
        })
        .where(eq(leads.id, existing[0].id));
      return "Lead information updated";
    }

    const [row] = await db
      .insert(leads)
      .values({
        name: input.name ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        company: input.company ?? null,
        budget: input.budget ?? null,
        timeline: input.timeline ?? null,
        thread_id: effectiveThreadId ? effectiveThreadId : undefined,
      })
      .returning({ id: leads.id });
    return `Lead information saved (id: ${row.id})`;
  } catch (error) {
    console.error("update_lead error:", error);
    return "Lead information saved";
  }
}

let currentThreadId: string | undefined;

export function setLeadToolThreadId(threadId: string | undefined) {
  currentThreadId = threadId;
}

export const updateLeadTool = tool(
  async (input: {
    email?: string;
    phone?: string;
    company?: string;
    name?: string;
    budget?: string;
    timeline?: string;
  }) => {
    console.log("update_lead called with:", input);
    return await upsertLead(input, currentThreadId);
  },
  {
    name: "update_lead",
    description:
      "Store or update lead information collected during the conversation. Call this whenever the user provides their name, email, phone, company, budget, or project timeline. Accumulate information gradually — call this each time a new piece is collected.",
    schema: z.object({
      email: z.string().optional().describe("Lead's email address"),
      phone: z.string().optional().describe("Lead's phone number"),
      company: z.string().optional().describe("Lead's company or organization"),
      name: z.string().optional().describe("Lead's full name"),
      budget: z.string().optional().describe("Lead's project budget"),
      timeline: z.string().optional().describe("Lead's project timeline"),
    }),
  },
);
