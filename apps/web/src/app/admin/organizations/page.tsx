import { requireAdmin } from "@/server/auth-guards";
import { listOrganizationsAdmin } from "@neylonai/domain/billing";
import { Card, CardContent, CardHeader, CardTitle } from "@neylonai/ui";

export default async function AdminOrganizationsPage() {
  await requireAdmin();
  let rows: Awaited<ReturnType<typeof listOrganizationsAdmin>> = [];
  try {
    rows = await listOrganizationsAdmin();
  } catch {
    rows = [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Tenant directory with plan and subscription status.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{rows.length} organizations</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No organizations yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Slug</th>
                  <th className="pb-2 pr-4 font-medium">Plan</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 font-medium">Provider</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="py-2.5 pr-4 font-medium">{r.name}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs">{r.slug}</td>
                    <td className="py-2.5 pr-4">{r.plan ?? "—"}</td>
                    <td className="py-2.5 pr-4">{r.status ?? "—"}</td>
                    <td className="py-2.5">{r.paymentProvider ?? "—"}</td>
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
