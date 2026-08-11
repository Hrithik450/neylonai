import { requireOrgMember } from "@/server/auth-guards";
import { UsagePanel } from "@/components/dashboard/usage-panel";

export default async function DashboardUsagePage() {
  await requireOrgMember();
  return <UsagePanel />;
}
