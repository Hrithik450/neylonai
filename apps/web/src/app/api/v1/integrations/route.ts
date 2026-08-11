import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth-cookies";
import {
  ApiAuthError,
  assertCanEnableIntegration,
  assertCanUseIntegration,
  buildPlanBadgeUpgradePrompt,
  getOrganizationForUser,
  getSubscriptionForOrg,
  listOrgIntegrations,
  setOrgIntegration,
} from "@neylonai/domain/billing";
import { hasAnySecret } from "@neylonai/domain/integrations";
import { getSyncedKnowledgeSnapshot } from "@neylonai/domain/knowledge";
import {
  connectedAccountLabel,
  configHasLegacyCredentials,
  getImportIngestKind,
  getIntegrationManifest,
  isConnectIntegration,
  isImportIntegration,
  isSyncIntegration,
  lastSyncLabel,
  listIntegrationManifests,
  redactIntegrationConfig,
  resolveIntegrationUiState,
} from "@neylonai/integrations/catalog";
import { deleteKnowledgeFileObject } from "@/server/knowledge-source-storage";

async function requireOrg(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session)
    return {
      error: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      ),
    };
  const org = await getOrganizationForUser(session.id);
  if (!org)
    return {
      error: NextResponse.json(
        { success: false, error: "No organization" },
        { status: 403 },
      ),
    };
  return { org };
}

export async function GET(req: NextRequest) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;

    const [subscription, installed] = await Promise.all([
      getSubscriptionForOrg(gate.org.organizationId),
      listOrgIntegrations(gate.org.organizationId),
    ]);
    const plan = subscription?.plan ?? "free";
    const byId = new Map(installed.map((i) => [i.integration_type, i]));
    const ctx = { organizationId: gate.org.organizationId, plan };

    const integrations = await Promise.all(
      listIntegrationManifests().map(async (manifest) => {
        const row = byId.get(manifest.id);
        let available = true;
        try {
          assertCanUseIntegration(ctx, manifest.id);
        } catch {
          available = false;
        }
        const enabled = row?.enabled ?? false;
        const installedFlag = Boolean(row);
        const rawConfig = (row?.config ?? {}) as Record<string, unknown>;
        const credentialKeys = manifest.credentialKeys ?? [];
        const config = redactIntegrationConfig(rawConfig, credentialKeys);
        const connectable = manifest.connectable !== false;
        const uiState = resolveIntegrationUiState({
          enabled,
          installed: installedFlag,
          available,
          connectable,
          config,
        });

        let credentialsConfigured = false;
        if (credentialKeys.length > 0 && row?.id) {
          credentialsConfigured =
            (await hasAnySecret({
              organizationIntegrationId: row.id,
              secretKeys: credentialKeys,
            })) || configHasLegacyCredentials(rawConfig, credentialKeys);
        }

        const knowledge =
          manifest.dataMode === "import"
            ? await getSyncedKnowledgeSnapshot(
                gate.org.organizationId,
                manifest.id,
              )
            : null;

        return {
          id: manifest.id,
          name: manifest.name,
          description: manifest.description,
          dataMode: manifest.dataMode,
          connectable,
          implemented:
            isImportIntegration(manifest.id) ||
            isConnectIntegration(manifest.id) ||
            isSyncIntegration(manifest.id),
          ingestKind: getImportIngestKind(manifest.id),
          planBadge: manifest.planBadge,
          logoUrl: manifest.logoUrl ?? null,
          stubNote: manifest.stubNote ?? null,
          available,
          enabled,
          installed: installedFlag,
          uiState,
          config,
          credentialsConfigured,
          connectedAccount: connectedAccountLabel(config),
          lastSyncAt: lastSyncLabel(config),
          knowledge,
        };
      }),
    );

    const lockedByPlan = integrations.find((i) => !i.available);
    const upgradePrompt = lockedByPlan
      ? buildPlanBadgeUpgradePrompt(plan, lockedByPlan.planBadge)
      : null;

    return NextResponse.json({
      success: true,
      data: {
        plan,
        integrations,
        upgradePrompt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load integrations",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  let plan = "free";
  let integrationId: string | undefined;

  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;

    const body = (await req.json().catch(() => ({}))) as {
      integrationId?: string;
      enabled?: boolean;
      config?: Record<string, unknown>;
    };
    integrationId = body.integrationId;
    if (!body.integrationId || typeof body.enabled !== "boolean") {
      return NextResponse.json(
        { success: false, error: "integrationId and enabled required" },
        { status: 400 },
      );
    }

    const manifest = getIntegrationManifest(body.integrationId);
    if (body.enabled && manifest && manifest.connectable === false) {
      return NextResponse.json(
        {
          success: false,
          error: "This integration is not available yet.",
        },
        { status: 400 },
      );
    }

    // Import mode uses /api/v1/integrations/knowledge (scrape / upload).
    // Connect mode (e.g. Evently) toggles here. Sync is not implemented yet.
    if (body.enabled && isImportIntegration(body.integrationId)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Use the Import flow for this integration (scrape or upload).",
        },
        { status: 400 },
      );
    }

    if (
      body.enabled &&
      manifest?.dataMode === "sync" &&
      !isSyncIntegration(body.integrationId)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "This Sync integration is not available yet.",
        },
        { status: 400 },
      );
    }

    if (
      body.enabled &&
      manifest?.dataMode === "connect" &&
      !isConnectIntegration(body.integrationId)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "This Connect integration is not available yet.",
        },
        { status: 400 },
      );
    }

    const subscription = await getSubscriptionForOrg(gate.org.organizationId);
    plan = subscription?.plan ?? "free";
    const ctx = {
      organizationId: gate.org.organizationId,
      plan,
    };

    if (body.enabled) {
      await assertCanEnableIntegration(ctx, body.integrationId);
    }

    const { storageKeys } = await setOrgIntegration(
      gate.org.organizationId,
      body.integrationId,
      {
        enabled: body.enabled,
        ...(body.config !== undefined ? { config: body.config } : {}),
      },
    );
    for (const key of storageKeys) {
      await deleteKnowledgeFileObject(key);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      const item = getIntegrationManifest(integrationId ?? "");
      const upgradePrompt = buildPlanBadgeUpgradePrompt(
        plan,
        item?.planBadge,
      );
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
          upgradePrompt,
        },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update integration",
      },
      { status: 500 },
    );
  }
}
