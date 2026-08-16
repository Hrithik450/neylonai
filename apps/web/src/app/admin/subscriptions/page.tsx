import { requireAdmin } from "@/server/auth-guards";
import {
  getPlanEntitlements,
  listSubscriptionsAdmin,
  normalizePlanId,
} from "@neylonai/domain/billing";
import { Card, CardContent, CardHeader, CardTitle } from "@neylonai/ui";

export default async function AdminSubscriptionsPage() {
  await requireAdmin();
  let rows: Awaited<ReturnType<typeof listSubscriptionsAdmin>> = [];
  try {
    rows = await listSubscriptionsAdmin();
  } catch {
    rows = [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Subscriptions</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{rows.length} records</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subscriptions.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Organization</th>
                  <th className="pb-2 pr-4 font-medium">Plan</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Credits bal</th>
                  <th className="pb-2 pr-4 font-medium">Granted</th>
                  <th className="pb-2 pr-4 font-medium">Used</th>
                  <th className="pb-2 pr-4 font-medium">Max queries S/St/C</th>
                  <th className="pb-2 pr-4 font-medium">Provider</th>
                  <th className="pb-2 font-medium">Period end</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const granted = Number(r.creditsPeriodGranted ?? 0);
                  const balance = Number(r.creditsBalance ?? 0);
                  const used = Math.max(0, granted - balance);
                  const plan = getPlanEntitlements(normalizePlanId(r.plan));
                  const quotas = plan.classQuotas;
                  return (
                    <tr key={r.id} className="border-b border-border/60">
                      <td className="py-2.5 pr-4">
                        <div className="font-medium">{r.orgName}</div>
                        <div className="text-muted-foreground font-mono text-xs">
                          {r.orgSlug}
                        </div>
                      </td>
                      <td className="py-2.5 pr-4">{plan.name}</td>
                      <td className="py-2.5 pr-4">{r.status}</td>
                      <td className="py-2.5 pr-4 tabular-nums font-semibold">
                        {balance.toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-4 tabular-nums">
                        {granted.toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-4 tabular-nums">
                        {used.toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-4 text-xs tabular-nums">
                        {quotas.simple}/{quotas.standard}/{quotas.complex}
                      </td>
                      <td className="py-2.5 pr-4">{r.paymentProvider ?? "—"}</td>
                      <td className="py-2.5 text-xs">
                        {r.periodEnd
                          ? new Date(r.periodEnd).toLocaleDateString()
                          : "—"}
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
