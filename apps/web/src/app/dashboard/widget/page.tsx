import { getWidgetConfigForOrg } from "@/server/widget-config";
import { WidgetConfigCenter } from "@/components/dashboard/widget-config-center";
import { requireOrgMember } from "@/server/auth-guards";
import {
  getPlanEntitlements,
  getSubscriptionForOrg,
  planHasFeature,
} from "@neylonai/domain/billing";

export default async function DashboardWidgetPage() {
  const member = await requireOrgMember();
  const [config, subscription] = await Promise.all([
    getWidgetConfigForOrg(member.organizationId),
    getSubscriptionForOrg(member.organizationId),
  ]);
  const entitlements = getPlanEntitlements(subscription?.plan);

  return (
    <WidgetConfigCenter
      initial={config}
      planId={entitlements.planId}
      fullWidgetCustomization={planHasFeature(
        entitlements,
        "full_widget_customization",
      )}
      advancedProactive={planHasFeature(entitlements, "advanced_proactive")}
    />
  );
}
