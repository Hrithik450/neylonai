/**
 * CRM lead sync contract — adapters live here so @neylonai/domain stays
 * provider-agnostic. HubSpot/Salesforce implement this later.
 */

export interface CrmLeadPayload {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CrmLeadSyncResult {
  ok: boolean;
  externalId?: string;
  error?: string;
}

export interface CrmAdapter {
  id: string;
  syncLead(lead: CrmLeadPayload): Promise<CrmLeadSyncResult>;
}

const adapters = new Map<string, CrmAdapter>();

export function registerCrmAdapter(adapter: CrmAdapter): void {
  adapters.set(adapter.id, adapter);
}

export function getCrmAdapter(id: string): CrmAdapter | undefined {
  return adapters.get(id);
}

export function listCrmAdapters(): string[] {
  return [...adapters.keys()];
}
