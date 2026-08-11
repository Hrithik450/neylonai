import { requireAdmin } from "@/server/auth-guards";
import { listSubscriptionsAdmin } from "@neylonai/domain/billing";
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
        <p className="text-muted-foreground text-sm mt-1">
          Server-authoritative state from webhooks and dashboard actions.
        </p>
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
                  <th className="pb-2 pr-4 font-medium">Provider</th>
                  <th className="pb-2 font-medium">Period end</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="py-2.5 pr-4">
                      <div className="font-medium">{r.orgName}</div>
                      <div className="text-muted-foreground font-mono text-xs">
                        {r.orgSlug}
                      </div>
                    </td>
                    <td className="py-2.5 pr-4">{r.plan}</td>
                    <td className="py-2.5 pr-4">{r.status}</td>
                    <td className="py-2.5 pr-4">{r.paymentProvider ?? "—"}</td>
                    <td className="py-2.5 text-xs">
                      {r.periodEnd
                        ? new Date(r.periodEnd).toLocaleDateString()
                        : "—"}
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
