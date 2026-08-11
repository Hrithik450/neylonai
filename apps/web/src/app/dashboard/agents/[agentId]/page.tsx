import { redirect } from "next/navigation";

/**
 * Individual agent pages are retired — use the master-detail Agents UI
 * with ?agent= query state instead.
 */
export default async function AgentWorkspaceRedirectPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  redirect(`/dashboard/agents?agent=${encodeURIComponent(agentId)}`);
}
