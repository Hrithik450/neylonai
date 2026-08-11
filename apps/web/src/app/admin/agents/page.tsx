import { count } from "drizzle-orm";
import { requireAdmin } from "@/server/auth-guards";
import { AGENT_CATALOG } from "@neylonai/domain/billing";
import { db, organizationAgents } from "@neylonai/database";
import { Card, CardContent, CardHeader, CardTitle } from "@neylonai/ui";

export default async function AdminAgentsPage() {
  await requireAdmin();

  let installed: Array<{ agentId: string; enabled: boolean; n: number }> = [];
  try {
    const rows = await db
      .select({
        agentId: organizationAgents.agent_id,
        enabled: organizationAgents.enabled,
        n: count(),
      })
      .from(organizationAgents)
      .groupBy(organizationAgents.agent_id, organizationAgents.enabled);
    installed = rows.map((r) => ({
      agentId: r.agentId,
      enabled: r.enabled,
      n: Number(r.n),
    }));
  } catch {
    installed = [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Catalog and org enablement across the platform.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {AGENT_CATALOG.map((agent) => {
          const enabled = installed
            .filter((r) => r.agentId === agent.id && r.enabled)
            .reduce((s, r) => s + r.n, 0);
          return (
            <Card key={agent.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{agent.name}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p className="text-muted-foreground">{agent.description}</p>
                <p>
                  Tier: <strong>{agent.tier}</strong> · Enabled orgs:{" "}
                  <strong>{enabled}</strong>
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
