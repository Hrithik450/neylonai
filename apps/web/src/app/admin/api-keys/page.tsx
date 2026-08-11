import { requireAdmin } from "@/server/auth-guards";
import { listApiKeysAdmin } from "@neylonai/domain/billing";
import { Card, CardContent, CardHeader, CardTitle } from "@neylonai/ui";

export default async function AdminApiKeysPage() {
  await requireAdmin();
  let rows: Awaited<ReturnType<typeof listApiKeysAdmin>> = [];
  try {
    rows = await listApiKeysAdmin();
  } catch {
    rows = [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">API keys</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Prefix + last four only. Full keys and hashes are never shown.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{rows.length} keys</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No API keys.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Organization</th>
                  <th className="pb-2 pr-4 font-medium">Display</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 font-medium">Last used</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="py-2.5 pr-4">{r.orgName}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs">
                      {r.prefix}…{r.lastFour}
                    </td>
                    <td className="py-2.5 pr-4">
                      {r.revokedAt ? "revoked" : "active"}
                    </td>
                    <td className="py-2.5 text-xs">
                      {r.lastUsedAt
                        ? new Date(r.lastUsedAt).toLocaleString()
                        : "never"}
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
