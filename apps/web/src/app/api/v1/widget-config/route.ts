import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth-cookies";
import {
  getOrganizationForUser,
  getPlanEntitlements,
  getSubscriptionForOrg,
  planHasFeature,
} from "@neylonai/domain/billing";
import {
  DEFAULT_WIDGET_CONFIG,
  mergeWidgetConfig,
  type StoredWidgetConfig,
} from "@/lib/widget-config-types";
import {
  getWidgetConfigForOrg,
  saveWidgetConfigForOrg,
} from "@/server/widget-config";

/**
 * Free plans may customize core branding + messaging + basic proactive toggles.
 * Layout, path targeting, feature tabs, and timing require fullWidgetCustomization.
 * Do not wipe appearance colors the dashboard still lets Free edit.
 */
function applyPlanLimits(
  incoming: StoredWidgetConfig,
  fullCustomization: boolean,
): StoredWidgetConfig {
  const merged = mergeWidgetConfig(incoming);
  if (fullCustomization) return merged;

  return {
    ...merged,
    layout: { ...DEFAULT_WIDGET_CONFIG.layout },
    features: {
      homeTab: true,
      messagesTab: true,
      contactTab: false,
      voiceInput: merged.features?.voiceInput ?? true,
    },
    website: { ...DEFAULT_WIDGET_CONFIG.website },
    proactive: {
      ...merged.proactive,
      volume: DEFAULT_WIDGET_CONFIG.proactive?.volume,
      initialIdleMs: DEFAULT_WIDGET_CONFIG.proactive?.initialIdleMs,
      displayMs: DEFAULT_WIDGET_CONFIG.proactive?.displayMs,
      rotateGapMs: DEFAULT_WIDGET_CONFIG.proactive?.rotateGapMs,
      postChatDelayMs: DEFAULT_WIDGET_CONFIG.proactive?.postChatDelayMs,
      poolLimit: DEFAULT_WIDGET_CONFIG.proactive?.poolLimit,
    },
    defaultOpen: false,
  };
}

/** Authenticated org members only — never expose another org's config. */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    const org = await getOrganizationForUser(session.id);
    if (!org) {
      return NextResponse.json(
        { success: false, error: "No organization" },
        { status: 403 },
      );
    }

    const [config, subscription] = await Promise.all([
      getWidgetConfigForOrg(org.organizationId),
      getSubscriptionForOrg(org.organizationId),
    ]);
    const entitlements = getPlanEntitlements(subscription?.plan);
    return NextResponse.json({
      success: true,
      data: {
        config,
        plan: entitlements.planId,
        fullWidgetCustomization: planHasFeature(
          entitlements,
          "full_widget_customization",
        ),
        advancedProactive: planHasFeature(entitlements, "advanced_proactive"),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load widget config",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    const org = await getOrganizationForUser(session.id);
    if (!org) {
      return NextResponse.json(
        { success: false, error: "No organization" },
        { status: 403 },
      );
    }

    const body = (await req.json()) as StoredWidgetConfig;
    const subscription = await getSubscriptionForOrg(org.organizationId);
    const entitlements = getPlanEntitlements(subscription?.plan);
    const full = planHasFeature(entitlements, "full_widget_customization");
    const limited = applyPlanLimits(body, full);
    const saved = await saveWidgetConfigForOrg(org.organizationId, limited);
    return NextResponse.json({
      success: true,
      data: {
        config: saved,
        plan: entitlements.planId,
        fullWidgetCustomization: full,
        advancedProactive: planHasFeature(entitlements, "advanced_proactive"),
        limited: !full,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to save widget config",
      },
      { status: 500 },
    );
  }
}
