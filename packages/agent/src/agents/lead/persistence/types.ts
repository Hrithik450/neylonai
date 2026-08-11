export interface LeadInput {
  email?: string;
  phone?: string;
  company?: string;
  name?: string;
  budget?: string;
  timeline?: string;
  thread_id?: string;
  organization_id?: string;
  source_agent_id?: string;
  status?: string;
}

export interface LeadRecord {
  id: string;
  organization_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  budget: string | null;
  timeline: string | null;
  thread_id: string | null;
  status: string | null;
  source_agent_id: string | null;
  crm_sync_status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type LeadFieldKey =
  | "name"
  | "email"
  | "phone"
  | "company"
  | "budget"
  | "timeline";
