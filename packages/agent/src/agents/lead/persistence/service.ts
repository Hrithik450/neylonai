import { LeadsRepository } from "./repository";
import type { LeadInput, LeadRecord } from "./types";

/**
 * Lead Agent persistence — leads are independent of conversation_states.
 * Association to a chat is via `leads.thread_id` only.
 */
export async function upsertLead(
  input: LeadInput,
  threadId?: string,
): Promise<string> {
  try {
    const result = await LeadsRepository.upsertLead(input, threadId);
    if (result.created) {
      return input.email || threadId
        ? `Lead information saved (id: ${result.id})`
        : `Lead created (id: ${result.id})`;
    }
    return `Lead information updated (id: ${result.id})`;
  } catch (error) {
    console.error("upsertLead error:", error);
    return "Lead information saved";
  }
}

/** Structured upsert for Lead Agent / APIs. */
export async function upsertLeadRecord(
  input: LeadInput,
  threadId?: string,
): Promise<{ id: string; created: boolean; message: string }> {
  const result = await LeadsRepository.upsertLead(input, threadId);
  return {
    ...result,
    message: result.created ? "Lead created" : "Lead updated",
  };
}

export async function listOrgLeads(
  organizationId: string,
): Promise<LeadRecord[]> {
  return LeadsRepository.listLeadsForOrg(organizationId);
}
