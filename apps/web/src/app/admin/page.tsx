import { requireAdmin } from "@/server/auth-guards";
import {
  getAdminPlatformMetrics,
  getPlanEntitlements,
  listOrganizationsUsageAdmin,
  normalizePlanId,
} from "@neylonai/domain/billing";
import { Card, CardContent, CardHeader, CardTitle } from "@neylonai/ui";
import Link from "next/link";

type Metrics = Awaited<ReturnType<typeof getAdminPlatformMetrics>>;
type Customers = Awaited<ReturnType<typeof listOrganizationsUsageAdmin>>;
type StatCard = { label: string; value: string; hint?: string };

const num = (value: number) => value.toLocaleString();
const usd = (value: number, digits = 2) =>
  `$${value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;

function errorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  return typeof reason === "string" ? reason : "Unknown error";
}

export default async function AdminOverviewPage() {
  await requireAdmin();

  const [metricsResult, customersResult] = await Promise.allSettled([
    getAdminPlatformMetrics(),
    listOrganizationsUsageAdmin(30),
  ]);

  const metrics: Metrics | null =
    metricsResult.status === "fulfilled" ? metricsResult.value : null;
  const customers: Customers | null =
    customersResult.status === "fulfilled" ? customersResult.value : null;

  const failures = [
    metricsResult.status === "rejected"
      ? `Platform metrics: ${errorMessage(metricsResult.reason)}`
      : null,
    customersResult.status === "rejected"
      ? `Customer usage: ${errorMessage(customersResult.reason)}`
      : null,
  ].filter((message): message is string => message != null);

  const windowDays = metrics?.windowDays ?? 30;

  const cards: StatCard[] = metrics
    ? [
        { label: "Organizations", value: num(metrics.organizations) },
        { label: "Users", value: num(metrics.users) },
        {
          label: "Active subscriptions",
          value: num(metrics.activeSubscriptions),
        },
        { label: "MRR", value: usd(metrics.mrrCents / 100, 0) },
        {
          label: `Credits charged (${windowDays}d)`,
          value: num(metrics.credits.includedCharged),
          hint:
            metrics.credits.onDemandCharged > 0
              ? `+ ${num(metrics.credits.onDemandCharged)} paid overage`
              : "no paid overage",
        },
        {
          label: "Credits left (all orgs)",
          value: num(metrics.credits.balance),
          hint: `${num(metrics.credits.granted)} granted this period`,
        },
        {
          label: `Provider COGS (${windowDays}d)`,
          value: usd(metrics.providerCostUsd),
        },
        {
          label: "Active API keys",
          value: num(metrics.activeApiKeys),
          hint: `${num(metrics.activeAgents)} orgs with the agent on · ${num(
            metrics.activeIntegrations,
          )} integration connections`,
        },
      ]
    : [];

  const topCustomers = (customers?.rows ?? [])
    .filter(
      (r) =>
        r.providerRequests > 0 ||
        r.creditRequests > 0 ||
        r.creditsCharged > 0 ||
        r.conversationTurns > 0 ||
        r.creditsUsedPeriod > 0,
    )
    .slice(0, 8);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Live platform data over the last {windowDays} days.
        </p>
      </div>

      {failures.length > 0 ? (
        <Card className="border-destructive/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-destructive text-base">
              Some metrics could not be loaded
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {failures.map((message) => (
              <p key={message} className="text-muted-foreground font-mono text-xs">
                {message}
              </p>
            ))}
            <p className="text-muted-foreground">
              Run <code className="font-mono">pnpm db:migrate</code> if the
              billing tables or columns are missing.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {cards.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((s) => (
            <Card key={s.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  {s.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums">{s.value}</p>
                {s.hint ? (
                  <p className="text-muted-foreground mt-1 text-xs">{s.hint}</p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">
            Customer usage (last {customers?.days ?? 30}d)
          </CardTitle>
          <Link
            href="/admin/organizations"
            className="text-sm underline underline-offset-4"
          >
            All customers →
          </Link>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {topCustomers.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No customer usage recorded yet.
            </p>
          ) : (
            <table className="w-full min-w-[52rem] text-left text-xs">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="pb-2 pr-3 font-medium">Customer</th>
                  <th className="pb-2 pr-3 font-medium">Plan</th>
                  <th className="pb-2 pr-3 font-medium">Credits left</th>
                  <th className="pb-2 pr-3 font-medium">Credits Consumed</th>
                  <th className="pb-2 pr-3 font-medium">Overage</th>
                  <th className="pb-2 pr-3 font-medium">Requests</th>
                  <th className="pb-2 pr-3 font-medium">COGS</th>
                  <th className="pb-2 font-medium">Turns</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((r) => (
                  <tr key={r.id} className="border-border/60 border-b">
                    <td className="py-2 pr-3">
                      <div className="text-sm font-medium">{r.name}</div>
                      <div className="text-muted-foreground font-mono text-[0.65rem]">
                        {r.slug}
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      {getPlanEntitlements(normalizePlanId(r.plan)).name}
                    </td>
                    <td className="py-2 pr-3 font-semibold tabular-nums">
                      {num(r.creditsBalance)}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {num(r.creditsCharged)}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {num(r.ledgerOnDemandCredits)}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {num(r.providerRequests)}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {usd(r.providerCostUsd, 4)}
                    </td>
                    <td className="py-2 tabular-nums">
                      {num(r.conversationTurns)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
