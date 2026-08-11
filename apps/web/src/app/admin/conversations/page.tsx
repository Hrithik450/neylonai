import { count, desc } from "drizzle-orm";
import { requireAdmin } from "@/server/auth-guards";
import { db, schema } from "@neylonai/database";
import { Card, CardContent, CardHeader, CardTitle } from "@neylonai/ui";

export default async function AdminConversationsPage() {
  await requireAdmin();

  let total = 0;
  let recent: Array<{
    id: string;
    title: string;
    created_at: Date | null;
  }> = [];
  try {
    const [t] = await db.select({ n: count() }).from(schema.threads);
    total = Number(t?.n ?? 0);
    recent = await db
      .select({
        id: schema.threads.id,
        title: schema.threads.title,
        created_at: schema.threads.created_at,
      })
      .from(schema.threads)
      .orderBy(desc(schema.threads.created_at))
      .limit(50);
  } catch {
    recent = [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Conversations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Platform thread volume ({total} total). Tenant dashboards remain
          org-scoped.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent threads</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No conversations.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Title</th>
                  <th className="pb-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((t) => (
                  <tr key={t.id} className="border-b border-border/60">
                    <td className="py-2.5 pr-4">{t.title}</td>
                    <td className="py-2.5 text-xs">
                      {t.created_at
                        ? new Date(t.created_at).toLocaleString()
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
