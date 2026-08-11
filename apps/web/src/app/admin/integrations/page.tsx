import { count } from "drizzle-orm";
import { requireAdmin } from "@/server/auth-guards";
import { listIntegrationManifests } from "@neylonai/integrations/catalog";
import { db, organizationIntegrations } from "@neylonai/database";
import { Card, CardContent, CardHeader, CardTitle } from "@neylonai/ui";

export default async function AdminIntegrationsPage() {
  await requireAdmin();

  let installed: Array<{
    integrationId: string;
    enabled: boolean;
    n: number;
  }> = [];
  try {
    const rows = await db
      .select({
        integrationId: organizationIntegrations.integration_type,
        enabled: organizationIntegrations.enabled,
        n: count(),
      })
      .from(organizationIntegrations)
      .groupBy(
        organizationIntegrations.integration_type,
        organizationIntegrations.enabled,
      );
    installed = rows.map((r) => ({
      integrationId: r.integrationId,
      enabled: r.enabled,
      n: Number(r.n),
    }));
  } catch {
    installed = [];
  }

  const catalog = listIntegrationManifests();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Platform-wide CRM and notification connection usage.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {catalog.map((item) => {
          const enabled = installed
            .filter((r) => r.integrationId === item.id && r.enabled)
            .reduce((s, r) => s + r.n, 0);
          return (
            <Card key={item.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{item.name}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p className="text-muted-foreground">{item.description}</p>
                <p>
                  {item.planBadge} · Enabled orgs: <strong>{enabled}</strong>
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
