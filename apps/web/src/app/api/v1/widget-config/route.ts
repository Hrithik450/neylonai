import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth-cookies";
import {
  getOrganizationForUser,
  getPlanEntitlements,
  getSubscriptionForOrg,
  planHasFeature,
} from "@neylonai/domain/billing";
import {
  mergeWidgetConfig,
  type StoredWidgetConfig,
} from "@/lib/widget-config-types";
import {
  getWidgetConfigForOrg,
  saveWidgetConfigForOrg,
} from "@/server/widget-config";

const requireOrg = async (req: NextRequest) => {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  const org = await getOrganizationForUser(session.id);
  if (!org) return { error: NextResponse.json({ success: false, error: "No organization" }, { status: 403 }) };
  return { org };
};

export async function GET(req: NextRequest) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;

    const [config, subscription] = await Promise.all([
      getWidgetConfigForOrg(gate.org.organizationId),
      getSubscriptionForOrg(gate.org.organizationId),
    ]);
    const entitlements = getPlanEntitlements(subscription?.plan);
    return NextResponse.json({
      success: true,
      data: {
        config,
        plan: entitlements.planId,
        advancedProactive: planHasFeature(entitlements, "advanced_proactive"),
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to load widget config" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;

    const body = (await req.json()) as StoredWidgetConfig;
    const subscription = await getSubscriptionForOrg(gate.org.organizationId);
    const entitlements = getPlanEntitlements(subscription?.plan);
    const saved = await saveWidgetConfigForOrg(gate.org.organizationId, mergeWidgetConfig(body));
    return NextResponse.json({
      success: true,
      data: {
        config: saved,
        plan: entitlements.planId,
        advancedProactive: planHasFeature(entitlements, "advanced_proactive"),
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to save widget config" }, { status: 500 });
  }
}
