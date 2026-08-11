import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth-cookies";
import {
  AGENT_CATALOG,
  ApiAuthError,
  assertCanUseAgent,
  buildFeatureUpgradePrompt,
  getOrganizationForUser,
  getSubscriptionForOrg,
  listOrgAgents,
  listOrgIntegrations,
  setOrgAgentEnabled,
} from "@neylonai/domain/billing";
import {
  listAgentManifests,
  getAgentManifest,
  getMissingRequiredIntegrations,
  isDefaultAgent,
} from "@neylonai/agent";
import {
  getAgentPerformance,
  getAgentOutcomeCounts,
} from "@neylonai/domain/conversations";

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

async function enabledIntegrationIds(
  organizationId: string,
): Promise<Set<string>> {
  const rows = await listOrgIntegrations(organizationId);
  return new Set(
    rows.filter((r) => r.enabled).map((r) => r.integration_type),
  );
}

/** Ensure built-in defaultActive agents exist as enabled when missing + requirements met. */
async function ensureDefaultAgents(
  organizationId: string,
  plan: string,
): Promise<void> {
  const installed = await listOrgAgents(organizationId);
  const byId = new Map(installed.map((a) => [a.agent_id, a]));
  const enabledIds = await enabledIntegrationIds(organizationId);

  for (const manifest of listAgentManifests()) {
    const existing = byId.get(manifest.id);

    // Default agent must always stay enabled.
    if (isDefaultAgent(manifest.id)) {
      if (!existing?.enabled) {
        await setOrgAgentEnabled(organizationId, manifest.id, true);
      }
      continue;
    }

    if (!manifest.defaultActive || existing) continue;
    try {
      assertCanUseAgent({ organizationId, plan }, manifest.id);
    } catch {
      continue;
    }
    const missing = getMissingRequiredIntegrations(
      manifest.requiredIntegrationIds,
      enabledIds,
    );
    if (missing.length > 0) continue;
    await setOrgAgentEnabled(organizationId, manifest.id, true);
  }
}

export async function GET(req: NextRequest) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;

    const url = new URL(req.url);
    const agentId = url.searchParams.get("agentId");

    const subscription = await getSubscriptionForOrg(gate.org.organizationId);
    const plan = subscription?.plan ?? "free";
    await ensureDefaultAgents(gate.org.organizationId, plan);

    const [installed, enabledIds] = await Promise.all([
      listOrgAgents(gate.org.organizationId),
      enabledIntegrationIds(gate.org.organizationId),
    ]);
    const byId = new Map(installed.map((a) => [a.agent_id, a]));
    const manifests = listAgentManifests();

    if (agentId) {
      const manifest = getAgentManifest(agentId);
      const catalog = AGENT_CATALOG.find((a) => a.id === agentId);
      if (!manifest && !catalog) {
        return NextResponse.json(
          { success: false, error: "Agent not found" },
          { status: 404 },
        );
      }
      const row = byId.get(agentId);
      const schema = manifest?.configSchema ?? [];
      const mergedConfig: Record<string, unknown> = { ...(row?.config ?? {}) };
      for (const field of schema) {
        if (mergedConfig[field.key] === undefined && "defaultValue" in field) {
          mergedConfig[field.key] = field.defaultValue;
        }
      }
      if (agentId === "lead" && mergedConfig.leadAgentEnabled === undefined) {
        mergedConfig.leadAgentEnabled = row?.enabled ?? true;
      }
      let available = false;
      try {
        assertCanUseAgent(
          { organizationId: gate.org.organizationId, plan },
          agentId,
        );
        available = true;
      } catch {
        available = false;
      }
      const requiredIntegrationIds = manifest?.requiredIntegrationIds ?? [];
      const missingRequiredIntegrations = getMissingRequiredIntegrations(
        requiredIntegrationIds,
        enabledIds,
      );
      const outcomeLabel = manifest?.outcomeMetric.label ?? "Outcomes";
      const performance = await getAgentPerformance(
        gate.org.organizationId,
        agentId,
        outcomeLabel,
      );
      return NextResponse.json({
        success: true,
        data: {
          plan,
          agent: {
            id: agentId,
            name: manifest?.name ?? catalog?.name ?? agentId,
            purpose:
              manifest?.purpose ??
              ("purpose" in (catalog ?? {})
                ? (catalog as { purpose?: string }).purpose
                : "") ??
              "",
            description: manifest?.description ?? catalog?.description ?? "",
            active: isDefaultAgent(agentId)
              ? true
              : (row?.enabled ?? manifest?.defaultActive ?? false),
            outcomeCount: performance.outcomeCount,
            outcomeLabel: performance.outcomeLabel,
            lastActivityAt: performance.lastActivityAt,
            lastActivityLabel: performance.lastActivityLabel,
            tier: manifest?.tier ?? catalog?.tier ?? "basic",
            available,
            config: mergedConfig,
            integrationIds: manifest?.integrationIds ?? [],
            requiredIntegrationIds,
            missingRequiredIntegrations,
            isDefault: isDefaultAgent(agentId),
            configSchema: schema,
            activityKinds: manifest?.activityKinds ?? [],
            builtIn: manifest?.builtIn ?? false,
            runnable: manifest?.runnable ?? false,
            performance: {
              conversations: performance.conversations,
              resolutions: performance.resolutions,
              escalations: performance.escalations,
              leadsOrActions: performance.leadsOrActions,
              outcomeLabel: performance.outcomeLabel,
            },
          },
          activity: performance.activity,
        },
      });
    }

    const outcomeCounts = await getAgentOutcomeCounts(
      gate.org.organizationId,
      manifests.map((m) => m.id),
    );

    const agents = manifests.map((manifest) => {
      const row = byId.get(manifest.id);
      let available = false;
      try {
        assertCanUseAgent(
          { organizationId: gate.org.organizationId, plan },
          manifest.id,
        );
        available = true;
      } catch {
        available = false;
      }
      const missingRequiredIntegrations = getMissingRequiredIntegrations(
        manifest.requiredIntegrationIds,
        enabledIds,
      );
      const enabled = isDefaultAgent(manifest.id)
        ? true
        : (row?.enabled ??
          (manifest.defaultActive &&
          available &&
          missingRequiredIntegrations.length === 0
            ? true
            : false));
      const stats = outcomeCounts.get(manifest.id);
      return {
        id: manifest.id,
        name: manifest.name,
        purpose: manifest.purpose,
        description: manifest.description,
        active: enabled,
        outcomeCount: stats?.outcomeCount ?? 0,
        outcomeLabel: manifest.outcomeMetric.label,
        lastActivityAt: stats?.lastActivityAt ?? null,
        lastActivityLabel: stats?.lastActivityLabel ?? null,
        tier: manifest.tier,
        available,
        config: row?.config ?? {},
        integrationIds: manifest.integrationIds,
        requiredIntegrationIds: manifest.requiredIntegrationIds,
        missingRequiredIntegrations,
        isDefault: isDefaultAgent(manifest.id),
      };
    });

    const needsAdvanced = agents.some(
      (a) => a.tier === "advanced" && !a.available,
    );
    const needsBasic = agents.some((a) => a.tier === "basic" && !a.available);
    const upgradePrompt = needsAdvanced
      ? buildFeatureUpgradePrompt(plan, "advanced_agents")
      : needsBasic
        ? buildFeatureUpgradePrompt(plan, "basic_agents")
        : null;

    return NextResponse.json({
      success: true,
      data: {
        plan,
        agents,
        upgradePrompt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load agents",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  let agentId: string | undefined;
  let organizationId: string | undefined;
  let plan = "free";

  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;
    organizationId = gate.org.organizationId;

    const body = (await req.json().catch(() => ({}))) as {
      agentId?: string;
      enabled?: boolean;
      config?: Record<string, unknown>;
    };
    agentId = body.agentId;
    if (!body.agentId || typeof body.enabled !== "boolean") {
      return NextResponse.json(
        { success: false, error: "agentId and enabled required" },
        { status: 400 },
      );
    }

    const subscription = await getSubscriptionForOrg(gate.org.organizationId);
    plan = subscription?.plan ?? "free";

    if (body.enabled === false && isDefaultAgent(body.agentId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Support Agent is the default agent and cannot be disabled.",
          code: "default_agent_required",
        },
        { status: 400 },
      );
    }

    if (body.enabled) {
      assertCanUseAgent(
        {
          organizationId: gate.org.organizationId,
          plan,
        },
        body.agentId,
      );

      const manifest = getAgentManifest(body.agentId);
      const enabledIds = await enabledIntegrationIds(gate.org.organizationId);
      const missing = getMissingRequiredIntegrations(
        manifest?.requiredIntegrationIds,
        enabledIds,
      );
      if (missing.length > 0) {
        const labels = missing.join(", ");
        return NextResponse.json(
          {
            success: false,
            error: `Enable required integrations first: ${labels}.`,
            code: "integrations_required",
            missingRequiredIntegrations: missing,
          },
          { status: 400 },
        );
      }
    }

    let enabled = body.enabled;
    const config = body.config
      ? ({ ...body.config } as Record<string, unknown>)
      : undefined;

    // Keep Lead's config checkbox in sync with the enable/disable control.
    // Never let a stale leadAgentEnabled:true override an explicit disable.
    if (body.agentId === "lead" && config) {
      config.leadAgentEnabled = enabled;
    }

    await setOrgAgentEnabled(
      gate.org.organizationId,
      body.agentId,
      enabled,
      config,
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      const agent = AGENT_CATALOG.find((a) => a.id === agentId);
      const upgradePrompt = buildFeatureUpgradePrompt(
        plan,
        agent?.tier === "advanced" ? "advanced_agents" : "basic_agents",
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
          error instanceof Error ? error.message : "Failed to update agent",
        organizationId,
      },
      { status: 500 },
    );
  }
}
