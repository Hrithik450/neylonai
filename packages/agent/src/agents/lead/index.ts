import { registerAgent } from "../../domain/registry";
import { leadAgent } from "./definition";

registerAgent(leadAgent);

export { leadAgent } from "./definition";
export { captureLeadTool } from "./capture-lead.tool";
export {
  upsertLead,
  upsertLeadRecord,
  listOrgLeads,
  LeadsRepository,
  type LeadInput,
  type LeadRecord,
  type LeadFieldKey,
} from "./persistence";
export {
  getLeadAgentSettings,
  DEFAULT_LEAD_FIELDS,
  type LeadAgentSettings,
} from "./settings";
