import { desc } from "drizzle-orm";
import { db, knowledgeDocuments } from "@neylonai/database";
import { requireAdmin } from "@/server/auth-guards";
import { Card, CardContent, CardHeader, CardTitle } from "@neylonai/ui";

export default async function AdminKnowledgePage() {
  await requireAdmin();

  let docs: Array<{ id: string; name: string | null; updated_at: Date | null }> =
    [];
  try {
    docs = await db
      .select({
        id: knowledgeDocuments.id,
        name: knowledgeDocuments.name,
        updated_at: knowledgeDocuments.updated_at,
      })
      .from(knowledgeDocuments)
      .orderBy(desc(knowledgeDocuments.updated_at))
      .limit(80);
  } catch {
    docs = [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Knowledge</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Cross-tenant document inventory (read-only).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents ({docs.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents.</p>
          ) : (
            docs.map((d) => (
              <div
                key={d.id}
                className="flex justify-between gap-4 border-b border-border/50 py-2 text-sm"
              >
                <span className="font-medium">
                  {d.name?.trim() || "Untitled"}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {d.updated_at
                    ? new Date(d.updated_at).toLocaleDateString()
                    : "—"}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
