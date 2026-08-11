import { requireAdmin } from "@/server/auth-guards";
import { Card, CardContent, CardHeader, CardTitle } from "@neylonai/ui";

export default async function AdminSystemPage() {
  await requireAdmin();

  const flags = [
    { key: "NEXT_PUBLIC_NEYLONAI_API_KEY", set: Boolean(process.env.NEXT_PUBLIC_NEYLONAI_API_KEY) },
    { key: "KNOWLEDGE_ORGANIZATION_SLUG (dev scripts)", set: Boolean(process.env.KNOWLEDGE_ORGANIZATION_SLUG) },
    { key: "KNOWLEDGE_BASE_SLUG (dev default KB)", set: Boolean(process.env.KNOWLEDGE_BASE_SLUG) },
    { key: "AUTH_SECRET / JWT_SECRET", set: Boolean(process.env.AUTH_SECRET || process.env.JWT_SECRET) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">System</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Environment / feature readiness (no secrets shown).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Config presence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {flags.map((f) => (
            <div
              key={f.key}
              className="flex items-center justify-between border-b border-border/50 py-2 text-sm"
            >
              <span className="font-mono text-xs sm:text-sm">{f.key}</span>
              <span
                className={
                  f.set ? "text-emerald-700 font-medium" : "text-muted-foreground"
                }
              >
                {f.set ? "Set" : "Missing"}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
