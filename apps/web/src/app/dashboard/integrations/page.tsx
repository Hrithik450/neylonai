import { requireOrgMember } from "@/server/auth-guards";
import { IntegrationsPanel } from "@/components/dashboard/integrations-panel";

export default async function IntegrationsPage() {
  await requireOrgMember();
  return <IntegrationsPanel />;
}
