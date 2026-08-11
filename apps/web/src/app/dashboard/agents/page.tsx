import { Suspense } from "react";
import { requireOrgMember } from "@/server/auth-guards";
import { AgentsMasterDetail } from "@/components/dashboard/agents-master-detail";

export default async function AgentsPage() {
  await requireOrgMember();
  return (
    <Suspense fallback={<p className="caption text-sm">Loading agents…</p>}>
      <AgentsMasterDetail />
    </Suspense>
  );
}
