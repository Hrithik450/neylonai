import { notFound } from "next/navigation";
import { requireOrgMember } from "@/server/auth-guards";
import { IntegrationDetailPanel } from "@/components/dashboard/integration-detail-panel";

const RETAINED_INTEGRATIONS = new Set([
  "website",
  "database",
  "web_search",
  "whatsapp",
  "calcom",
]);

export default async function IntegrationDetailPage({
  params,
}: {
  params: Promise<{ integrationId: string }>;
}) {
  await requireOrgMember();
  const { integrationId } = await params;
  if (!RETAINED_INTEGRATIONS.has(integrationId)) notFound();
  return <IntegrationDetailPanel integrationId={integrationId} />;
}
