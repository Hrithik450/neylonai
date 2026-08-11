import { requireOrgMember } from "@/server/auth-guards";
import { loadDashboardOverview } from "@/server/dashboard-overview";
import { DashboardOverview } from "@/components/dashboard/overview";

export default async function DashboardOverviewPage() {
  const member = await requireOrgMember();
  const data = await loadDashboardOverview(member);
  return <DashboardOverview data={data} />;
}
