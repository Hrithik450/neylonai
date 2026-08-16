import Link from "next/link";
import { requireAdmin } from "@/server/auth-guards";
import {
  AI_CREDIT_CLASSES,
  listConversationUsageMetricsAdmin,
  type AiCreditClass,
} from "@neylonai/domain/billing";
import { Card, CardContent, CardHeader, CardTitle } from "@neylonai/ui";

const number = (value: number) => Math.round(value).toLocaleString();
const PAGE_SIZE = 50;

export default async function AdminUsageMetricsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  await requireAdmin();
  const params = (await searchParams) ?? {};
  const page = Math.max(1, Number(params.page) || 1);
  const { rows, total, byWorkload, pageSize } =
    await listConversationUsageMetricsAdmin({ page, pageSize: PAGE_SIZE });
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const cards = AI_CREDIT_CLASSES.flatMap((workload: AiCreditClass) => {
    const stats = byWorkload[workload];
    return [
      {
        label: `${workload} avg input tokens`,
        value: stats.avgInput,
        hint: `RAG ~${number(stats.avgRag)} tokens`,
      },
      {
        label: `${workload} avg output tokens`,
        value: stats.avgOutput,
        hint: `${number(stats.avgTools)} tool calls · ${stats.turns} turns`,
      },
    ];
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Usage metrics</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-muted-foreground text-xs capitalize">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold tabular-nums">
                {number(card.value)}
              </p>
              <p className="text-muted-foreground text-xs">{card.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="space-y-4 overflow-x-auto pt-6">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead>
              <tr className="text-muted-foreground border-b">
                {[
                  "Time",
                  "Organization",
                  "Workload",
                  "RAG tokens (est.)",
                  "DB rows",
                  "Input tokens",
                  "Output tokens",
                  "Tool calls",
                ].map((label) => (
                  <th key={label} className="pb-2 pr-4 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-border/60 border-b">
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {row.createdAt?.toLocaleString() ?? "—"}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    <div className="font-medium">
                      {row.organizationName ?? row.organizationId}
                    </div>
                    {row.organizationSlug ? (
                      <div className="text-muted-foreground font-mono text-[0.65rem]">
                        {row.organizationSlug}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-2 pr-4 capitalize">{row.workload}</td>
                  {[
                    row.ragTokens,
                    row.databaseRows,
                    row.inputTokens,
                    row.outputTokens,
                    row.toolCalls,
                  ].map((value, index) => (
                    <td key={index} className="py-2 pr-4 tabular-nums">
                      {Number(value).toLocaleString()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span>
              Page {page} of {pages} · {total.toLocaleString()} turns
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={`/admin/usage-metrics?page=${page - 1}`}
                  className="hover:text-foreground underline-offset-2 hover:underline"
                >
                  Previous
                </Link>
              ) : (
                <span className="opacity-40">Previous</span>
              )}
              {page < pages ? (
                <Link
                  href={`/admin/usage-metrics?page=${page + 1}`}
                  className="hover:text-foreground underline-offset-2 hover:underline"
                >
                  Next
                </Link>
              ) : (
                <span className="opacity-40">Next</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
