import { NextRequest, NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";
import { db, knowledgeDocuments } from "@neylonai/database";
import {
  getOrganizationForUser,
  listApiKeysForOrg,
  listOrgIntegrations,
} from "@neylonai/domain/billing";
import {
  DEFAULT_WIDGET_CONFIG,
  getWidgetConfigForOrg,
  type StoredWidgetConfig,
} from "@/server/widget-config";
import { getSessionFromRequest } from "@/server/auth-cookies";

/**
 * Mirrors the same-named helper in dashboard-overview.ts: branding counts as
 * "customized" once the operator changes the chatbot's name or primary text
 * color away from the shipped defaults.
 */
function brandingCustomized(config: StoredWidgetConfig): boolean {
  const name = config.branding?.name?.trim();
  const color = config.branding?.primaryTextColor?.trim();
  const defaultName = DEFAULT_WIDGET_CONFIG.branding?.name;
  const defaultColor = DEFAULT_WIDGET_CONFIG.branding?.primaryTextColor;
  if (name && name !== defaultName) return true;
  if (color && color !== defaultColor) return true;
  return false;
}

/**
 * Live completion signals for the action-gated onboarding tour. The overlay
 * polls this while an action step is visible and advances the moment the
 * relevant gate flips true. Cheap, org-scoped, no side effects.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session)
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    const org = await getOrganizationForUser(session.id);
    if (!org)
      return NextResponse.json(
        { success: false, error: "No organization" },
        { status: 403 },
      );

    const organizationId = org.organizationId;
    const [keys, config, integrations] = await Promise.all([
      listApiKeysForOrg(organizationId),
      getWidgetConfigForOrg(organizationId),
      listOrgIntegrations(organizationId),
    ]);

    const hasKey = keys.some((k) => !k.revokedAt);

    const websiteEnabled = integrations.some(
      (i) => i.integration_id === "website" && i.enabled,
    );
    let docCount = 0;
    if (!websiteEnabled) {
      try {
        const [row] = await db
          .select({ n: count() })
          .from(knowledgeDocuments)
          .where(eq(knowledgeDocuments.organization_id, organizationId));
        docCount = Number(row?.n ?? 0);
      } catch {
        docCount = 0;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        hasKey,
        brandingCustomized: brandingCustomized(config),
        websiteConnected: websiteEnabled || docCount > 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load status",
      },
      { status: 500 },
    );
  }
}
