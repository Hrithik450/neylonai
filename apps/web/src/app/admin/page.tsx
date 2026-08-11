import { requireAdmin } from "@/server/auth-guards";
import { getAdminPlatformMetrics } from "@neylonai/domain/billing";
import { Card, CardContent, CardHeader, CardTitle } from "@neylonai/ui";
import Link from "next/link";

export default async function AdminOverviewPage() {
  await requireAdmin();

  let metrics: Awaited<ReturnType<typeof getAdminPlatformMetrics>> | null =
    null;
  try {
    metrics = await getAdminPlatformMetrics();
  } catch {
    metrics = null;
  }

  const cards = metrics
    ? [
        { label: "Organizations", value: metrics.organizations },
        { label: "Active subscriptions", value: metrics.activeSubscriptions },
        {
          label: "MRR",
          value: `$${(metrics.mrrCents / 100).toFixed(0)}`,
        },
        {
          label: "ARR",
          value: `$${(metrics.arrCents / 100).toFixed(0)}`,
        },
        {
          label: "Provider COGS (30d)",
          value: `$${metrics.providerCostUsd.toFixed(2)}`,
        },
        {
          label: "Conversations (30d)",
          value: metrics.usage.conversations,
        },
        { label: "Active agents", value: metrics.activeAgents },
        { label: "Integrations on", value: metrics.activeIntegrations },
      ]
    : [
        { label: "Organizations", value: "—" },
        { label: "Active subscriptions", value: "—" },
      ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Platform-level visibility. Customer dashboards never see cross-tenant
          data.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {metrics ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan mix</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 text-sm">
            {Object.entries(metrics.planDistribution).map(([plan, n]) => (
              <span key={plan}>
                <strong className="capitalize">{plan}</strong>: {n}
              </span>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/admin/organizations" className="underline">
          Organizations
        </Link>
        <Link href="/admin/subscriptions" className="underline">
          Subscriptions
        </Link>
        <Link href="/admin/unit-economics" className="underline">
          Unit Economics
        </Link>
        <Link href="/admin/api-keys" className="underline">
          API keys
        </Link>
      </div>
    </div>
  );
}
