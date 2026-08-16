import { requireAdmin } from "@/server/auth-guards";
import {
  getPlanEntitlements,
  listOrganizationsUsageAdmin,
  normalizePlanId,
  setOrganizationBlockedAdmin,
} from "@neylonai/domain/billing";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@neylonai/ui";
import { revalidatePath } from "next/cache";

async function setBlocked(formData: FormData) {
  "use server";
  await requireAdmin();
  const organizationId = String(formData.get("organizationId") ?? "");
  const blocked = formData.get("blocked") === "true";
  if (!/^[0-9a-f-]{36}$/i.test(organizationId)) return;
  await setOrganizationBlockedAdmin(organizationId, blocked);
  revalidatePath("/admin/organizations");
}

function money(n: number) {
  return `$${n.toFixed(4)}`;
}

function fmtWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export default async function AdminOrganizationsPage() {
  await requireAdmin();
  let report: Awaited<ReturnType<typeof listOrganizationsUsageAdmin>> = {
    days: 30,
    since: new Date().toISOString(),
    rows: [],
  };
  try {
    report = await listOrganizationsUsageAdmin(30);
  } catch {
    report = { days: 30, since: new Date().toISOString(), rows: [] };
  }

  const { rows, days } = report;
  const totals = rows.reduce(
    (acc, r) => {
      acc.providerRequests += r.providerRequests;
      acc.providerCostUsd += r.providerCostUsd;
      acc.creditsCharged += r.creditsCharged;
      acc.conversationTurns += r.conversationTurns;
      acc.creditsUsedPeriod += r.creditsUsedPeriod;
      return acc;
    },
    {
      providerRequests: 0,
      providerCostUsd: 0,
      creditsCharged: 0,
      conversationTurns: 0,
      creditsUsedPeriod: 0,
    },
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
        <p className="text-muted-foreground text-sm mt-1 max-w-3xl">
          Every customer tenant with plan, AI credit balance, and live usage
          (last {days}d).
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {(
          [
            ["Customers", rows.length.toLocaleString()],
            ["Requests (30d)", totals.providerRequests.toLocaleString()],
            ["Provider COGS", money(totals.providerCostUsd)],
            ["Credits charged", totals.creditsCharged.toLocaleString()],
            ["Conversation turns", totals.conversationTurns.toLocaleString()],
          ] as const
        ).map(([label, value]) => (
          <Card key={label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">
            {rows.length} organizations · customer usage
          </CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 overflow-x-auto overscroll-x-contain">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No organizations yet.
            </p>
          ) : (
            <table className="w-max min-w-full text-left text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="pb-2 pr-6 font-medium whitespace-nowrap">
                    Customer
                  </th>
                  <th className="pb-2 pr-6 font-medium whitespace-nowrap">
                    Plan
                  </th>
                  <th className="pb-2 pr-6 font-medium whitespace-nowrap">
                    Subscription
                  </th>
                  <th className="pb-2 pr-6 font-medium whitespace-nowrap">
                    Access
                  </th>
                  <th className="pb-2 pr-6 font-medium whitespace-nowrap">
                    Credits bal
                  </th>
                  <th className="pb-2 pr-6 font-medium whitespace-nowrap">
                    Granted
                  </th>
                  <th className="pb-2 pr-6 font-medium whitespace-nowrap">
                    Used (period)
                  </th>
                  <th className="pb-2 pr-6 font-medium whitespace-nowrap">
                    Charged (30d)
                  </th>
                  <th className="pb-2 pr-6 font-medium whitespace-nowrap">
                    Max queries S/St/C
                  </th>
                  <th className="pb-2 pr-6 font-medium whitespace-nowrap">
                    Paid overage
                  </th>
                  <th className="pb-2 pr-6 font-medium whitespace-nowrap">
                    Requests
                  </th>
                  <th className="pb-2 pr-6 font-medium whitespace-nowrap">
                    COGS
                  </th>
                  <th className="pb-2 pr-6 font-medium whitespace-nowrap">
                    Turns
                  </th>
                  <th className="pb-2 pr-6 font-medium whitespace-nowrap">
                    Threads
                  </th>
                  <th className="pb-2 pr-6 font-medium whitespace-nowrap">
                    Last activity
                  </th>
                  <th className="pb-2 pl-2 pr-1 font-medium whitespace-nowrap">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const plan = getPlanEntitlements(normalizePlanId(r.plan));
                  const quotas = plan.classQuotas;
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-border/60 align-top"
                    >
                      <td className="py-2.5 pr-6 whitespace-nowrap">
                        <div className="font-medium text-sm">{r.name}</div>
                        <div className="text-muted-foreground font-mono text-[0.65rem]">
                          {r.slug}
                        </div>
                      </td>
                      <td className="py-2.5 pr-6 whitespace-nowrap">
                        {plan.name}
                      </td>
                      <td className="py-2.5 pr-6 whitespace-nowrap">
                        {r.status ?? "—"}
                      </td>
                      <td className="py-2.5 pr-6 whitespace-nowrap">
                        {r.blockedAt ? "Blocked" : "Active"}
                      </td>
                      <td className="py-2.5 pr-6 tabular-nums font-semibold whitespace-nowrap">
                        {r.creditsBalance.toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-6 tabular-nums whitespace-nowrap">
                        {r.creditsPeriodGranted.toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-6 tabular-nums whitespace-nowrap">
                        {r.creditsUsedPeriod.toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-6 tabular-nums whitespace-nowrap">
                        {r.creditsCharged.toLocaleString()}
                        <span className="text-muted-foreground block">
                          {r.creditRequests} req
                        </span>
                      </td>
                      <td className="py-2.5 pr-6 tabular-nums whitespace-nowrap">
                        {quotas.simple}/{quotas.standard}/{quotas.complex}
                      </td>
                      <td className="py-2.5 pr-6 tabular-nums whitespace-nowrap">
                        {r.ledgerOnDemandCredits.toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-6 tabular-nums whitespace-nowrap">
                        {r.providerRequests.toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-6 tabular-nums whitespace-nowrap">
                        {money(r.providerCostUsd)}
                      </td>
                      <td className="py-2.5 pr-6 tabular-nums whitespace-nowrap">
                        {r.conversationTurns.toLocaleString()}
                        {r.proactiveRefreshes > 0 ? (
                          <span className="text-muted-foreground block">
                            +{r.proactiveRefreshes} tips
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-6 tabular-nums whitespace-nowrap">
                        {r.threads.toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-6 text-muted-foreground whitespace-nowrap">
                        {fmtWhen(r.lastActivityAt)}
                      </td>
                      <td className="py-2.5 pl-2 pr-1 whitespace-nowrap align-middle">
                        <form action={setBlocked} className="inline-flex">
                          <input type="hidden" name="organizationId" value={r.id} />
                          <input
                            type="hidden"
                            name="blocked"
                            value={r.blockedAt ? "false" : "true"}
                          />
                          <Button
                            type="submit"
                            size="sm"
                            variant={r.blockedAt ? "outline" : "destructive"}
                          >
                            {r.blockedAt ? "Unblock" : "Block"}
                          </Button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
