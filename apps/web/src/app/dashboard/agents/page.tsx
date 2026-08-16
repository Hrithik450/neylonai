import { requireOrgMember } from "@/server/auth-guards";
import { AgentsMasterDetail } from "@/components/dashboard/agents-master-detail";

export default async function AgentsPage() {
  await requireOrgMember();
  return <AgentsMasterDetail />;
}
