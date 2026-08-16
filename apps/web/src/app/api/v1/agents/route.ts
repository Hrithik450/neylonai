import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth-cookies";
import {
  ApiAuthError,
  assertCanUseAgentRecord,
  getOrganizationForUser,
  getSubscriptionForOrg,
  listOrgAgents,
  listOrgIntegrations,
  setOrgAgentEnabled,
} from "@neylonai/domain/billing";
import { MAIN_AGENT_KEY, OrgAgentsService } from "@neylonai/domain/agents";
import {
  getAgentManifest,
  getMissingRequiredIntegrations,
  listAgentManifests,
  sortAgentsForDisplay,
  type AgentManifest,
} from "@neylonai/agent";
import {
  getAgentPerformance,
  getAgentOutcomeCounts,
} from "@neylonai/domain/conversations";

const requireOrg = async (req: NextRequest) => {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  const org = await getOrganizationForUser(session.id);
  if (!org) return { error: NextResponse.json({ success: false, error: "No organization" }, { status: 403 }) };
  return { org };
};

const enabledIntegrationIds = async (organizationId: string) =>
  new Set((await listOrgIntegrations(organizationId)).filter(r => r.enabled).map(r => r.integration_id));

const isMain = (manifest: AgentManifest) => manifest.role === "main" || manifest.id === MAIN_AGENT_KEY;

const catalogStatus = (manifest: AgentManifest): "active" | "inactive" =>
  manifest.runnable || isMain(manifest) ? "active" : "inactive";

const dashboardManifests = (orgRows: Awaited<ReturnType<typeof listOrgAgents>>) => {
  const connectedKeys = new Set(orgRows.map(r => r.agentKey));
  return listAgentManifests().filter(m => isMain(m) || connectedKeys.has(m.id));
};

function serializeAgentListItem(manifest: AgentManifest, opts: {
  plan: string;
  organizationId: string;
  row?: { enabled: boolean; extra: Record<string, unknown> | null };
  enabledIds: Set<string>;
  stats?: { outcomeCount: number; lastActivityAt: string | null; lastActivityLabel: string | null };
}) {
  const status = catalogStatus(manifest);
  let available = false;
  try {
    assertCanUseAgentRecord({ organizationId: opts.organizationId, plan: opts.plan }, { role: manifest.role, tier: manifest.tier, status, name: manifest.name });
    available = true;
  } catch {}

  const requiredIntegrationIds = manifest.requiredIntegrationIds ?? [];
  const main = isMain(manifest);

  return {
    id: manifest.id,
    name: manifest.name,
    description: manifest.description,
    active: main ? true : (opts.row?.enabled ?? false),
    outcomeCount: opts.stats?.outcomeCount ?? 0,
    outcomeLabel: manifest.outcomeMetric.label ?? "Outcomes",
    lastActivityAt: opts.stats?.lastActivityAt ?? null,
    lastActivityLabel: opts.stats?.lastActivityLabel ?? null,
    tier: manifest.tier,
    available,
    status,
    extra: opts.row?.extra ?? {},
    integrationIds: manifest.integrationIds ?? [],
    requiredIntegrationIds,
    missingRequiredIntegrations: getMissingRequiredIntegrations(requiredIntegrationIds, opts.enabledIds),
    isDefault: main,
    role: manifest.role,
    capabilities: manifest.capabilities ?? [],
  };
}

export async function GET(req: NextRequest) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;

    const url = new URL(req.url);
    const agentId = url.searchParams.get("agentId");

    const subscription = await getSubscriptionForOrg(gate.org.organizationId);
    const plan = subscription?.plan ?? "free";

    await OrgAgentsService.ensureMainAgent(gate.org.organizationId);

    const [installed, enabledIds] = await Promise.all([
      listOrgAgents(gate.org.organizationId),
      enabledIntegrationIds(gate.org.organizationId),
    ]);
    const byKey = new Map(installed.map((a) => [a.agentKey, a]));

    if (agentId) {
      const manifest = getAgentManifest(agentId);
      if (!manifest) {
        return NextResponse.json(
          { success: false, error: "Agent not found" },
          { status: 404 },
        );
      }

      // Specialized detail only when connected (row exists).
      const row = byKey.get(agentId);
      if (!isMain(manifest) && !row) {
        return NextResponse.json(
          { success: false, error: "Agent not found" },
          { status: 404 },
        );
      }

      const schema = manifest.configSchema ?? [];
      const mergedExtra: Record<string, unknown> = {
        ...(row?.extra ?? {}),
      };
      for (const field of schema) {
        if (mergedExtra[field.key] === undefined && "defaultValue" in field) {
          mergedExtra[field.key] = field.defaultValue;
        }
      }

      const listItem = serializeAgentListItem(manifest, {
        plan,
        organizationId: gate.org.organizationId,
        row: row
          ? {
              enabled: row.enabled,
              extra: row.extra,
            }
          : undefined,
        enabledIds,
      });

      const outcomeLabel = manifest.outcomeMetric.label ?? "Outcomes";
      const performance = await getAgentPerformance(
        gate.org.organizationId,
        manifest.id,
        outcomeLabel,
      );

      const listed = dashboardManifests(installed);
      const accessToAgents = isMain(manifest)
        ? listed
            .filter((a) => a.id !== manifest.id)
            .map((a) => {
              const r = byKey.get(a.id);
              return {
                id: a.id,
                name: a.name,
                description: a.description,
                status: catalogStatus(a),
                active: isMain(a) ? true : (r?.enabled ?? false),
              };
            })
        : [];

      return NextResponse.json({
        success: true,
        data: {
          plan,
          agent: {
            ...listItem,
            extra: mergedExtra,
            configSchema: schema,
            activityKinds: manifest.activityKinds ?? [],
            accessToAgents,
            performance: {
              conversations: performance.conversations,
              resolutions: performance.resolutions,
              escalations: performance.escalations,
              actions: performance.actions,
              outcomeLabel: performance.outcomeLabel,
            },
            outcomeCount: performance.outcomeCount,
            lastActivityAt: performance.lastActivityAt,
            lastActivityLabel: performance.lastActivityLabel,
          },
          activity: performance.activity,
        },
      });
    }

    const listed = dashboardManifests(installed);
    const outcomeCounts = await getAgentOutcomeCounts(
      gate.org.organizationId,
      listed.map((a) => a.id),
    );

    const agents = listed.map((manifest) => {
      const row = byKey.get(manifest.id);
      return serializeAgentListItem(manifest, {
        plan,
        organizationId: gate.org.organizationId,
        row: row
          ? {
              enabled: row.enabled,
              extra: row.extra,
            }
          : undefined,
        enabledIds,
        stats: outcomeCounts.get(manifest.id),
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        plan,
        agents: sortAgentsForDisplay(agents),
        upgradePrompt: null,
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
  let organizationId: string | undefined;
  let plan = "free";

  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;
    organizationId = gate.org.organizationId;

    const body = (await req.json().catch(() => ({}))) as {
      agentId?: string;
      enabled?: boolean;
      extra?: Record<string, unknown>;
    };

    const subscription = await getSubscriptionForOrg(gate.org.organizationId);
    plan = subscription?.plan ?? "free";

    if (!body.agentId || typeof body.enabled !== "boolean") {
      return NextResponse.json(
        {
          success: false,
          error: "agentId and enabled required",
        },
        { status: 400 },
      );
    }

    const manifest = getAgentManifest(body.agentId);
    if (!manifest) {
      return NextResponse.json(
        { success: false, error: "Agent not found" },
        { status: 404 },
      );
    }

    if (body.enabled === false && isMain(manifest)) {
      return NextResponse.json(
        {
          success: false,
          error: "Main Agent is the default agent and cannot be disabled.",
          code: "default_agent_required",
        },
        { status: 400 },
      );
    }

    if (body.enabled) {
      assertCanUseAgentRecord(
        { organizationId: gate.org.organizationId, plan },
        { role: manifest.role, tier: manifest.tier, status: catalogStatus(manifest), name: manifest.name },
      );

      const required = manifest.requiredIntegrationIds ?? [];
      const enabledIds = await enabledIntegrationIds(gate.org.organizationId);
      const missing = getMissingRequiredIntegrations(required, enabledIds);
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

    await setOrgAgentEnabled(
      gate.org.organizationId,
      body.agentId,
      body.enabled,
      body.extra ? { ...body.extra } : undefined,
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
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
