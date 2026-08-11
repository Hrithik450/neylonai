import { desc } from "drizzle-orm";
import { db, schema } from "@neylonai/database";
import { requireAdmin } from "@/server/auth-guards";
import { Card, CardContent, CardHeader, CardTitle } from "@neylonai/ui";

export default async function AdminLeadsPage() {
  await requireAdmin();

  let leads: Array<{
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    company: string | null;
    created_at: Date | null;
  }> = [];
  try {
    leads = await db
      .select({
        id: schema.leads.id,
        name: schema.leads.name,
        email: schema.leads.email,
        phone: schema.leads.phone,
        company: schema.leads.company,
        created_at: schema.leads.created_at,
      })
      .from(schema.leads)
      .orderBy(desc(schema.leads.created_at))
      .limit(100);
  } catch {
    leads = [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Captured by the support agent.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Queue</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {leads.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leads yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">Company</th>
                  <th className="pb-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-b border-border/60">
                    <td className="py-2.5 pr-4">{l.name || "—"}</td>
                    <td className="py-2.5 pr-4">{l.email || "—"}</td>
                    <td className="py-2.5 pr-4">{l.company || "—"}</td>
                    <td className="py-2.5">
                      {l.created_at
                        ? new Date(l.created_at).toLocaleDateString()
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
