import { requireAdmin } from "@/server/auth-guards";
import { getUnitEconomicsReport } from "@neylonai/domain/billing";
import { Card, CardContent, CardHeader, CardTitle } from "@neylonai/ui";
import type { ReactNode } from "react";

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">{children}</CardContent>
    </Card>
  );
}

function money(n: number, d = 0) {
  return `$${n.toFixed(d)}`;
}

export default async function AdminUnitEconomicsPage() {
  await requireAdmin();
  const report = getUnitEconomicsReport();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Unit Economics</h1>
        <p className="text-muted-foreground text-sm mt-1 max-w-3xl">
          {report.purpose} Rates cited {report.asOf}. Re-check official sources
          before changing numbers.
        </p>
      </div>

      <Section title="Stack catalog (official pricing)">
        <p className="text-muted-foreground text-xs">
          Every technology currently used in this product. Pricing is from
          provider docs — not from usage_events.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-1 pr-2">Category</th>
                <th className="py-1 pr-2">Provider</th>
                <th className="py-1 pr-2">Model / service</th>
                <th className="py-1 pr-2">Used for</th>
                <th className="py-1 pr-2">Official pricing</th>
                <th className="py-1 pr-2">Unit</th>
                <th className="py-1 pr-2">Free tier / quotas</th>
                <th className="py-1">Source</th>
              </tr>
            </thead>
            <tbody>
              {report.catalog.map((row) => (
                <tr
                  key={`${row.category}-${row.service}`}
                  className="border-b border-border/40 align-top"
                >
                  <td className="py-1.5 pr-2 font-medium">{row.category}</td>
                  <td className="py-1.5 pr-2">{row.provider}</td>
                  <td className="py-1.5 pr-2 font-mono text-[0.7rem]">
                    {row.service}
                  </td>
                  <td className="py-1.5 pr-2">{row.usedFor}</td>
                  <td className="py-1.5 pr-2">{row.pricing}</td>
                  <td className="py-1.5 pr-2">{row.unit}</td>
                  <td className="py-1.5 pr-2">{row.freeTierOrQuotas}</td>
                  <td className="py-1.5 text-muted-foreground break-all">
                    {row.source}
                    <span className="block">as of {row.asOf}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground text-xs">
          {report.rateLimitsNote.text}{" "}
          <span className="font-mono">{report.rateLimitsNote.source}</span>
        </p>
      </Section>

      {report.phases.map((phase) => (
        <Section key={phase.id} title={phase.title}>
          <p>{phase.summary}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-xs">
            <div className="rounded border p-2">
              <p className="text-muted-foreground">Infra $/mo (planning)</p>
              <p className="font-semibold tabular-nums">
                {money(phase.infrastructureMonthlyUsd.min)}–
                {money(phase.infrastructureMonthlyUsd.max)}
              </p>
              <p className="text-muted-foreground mt-1">
                {phase.infrastructureMonthlyUsd.note}
              </p>
            </div>
            <div className="rounded border p-2">
              <p className="text-muted-foreground">Est. customers</p>
              <p className="font-semibold tabular-nums">
                {phase.estimatedCustomers.min ?? "?"}–
                {phase.estimatedCustomers.max ?? "∞"}
              </p>
              <p className="text-muted-foreground mt-1">
                {phase.estimatedCustomers.basis}
              </p>
            </div>
            <div className="rounded border p-2">
              <p className="text-muted-foreground">Suggested plan band</p>
              <p className="font-medium">{phase.recommendedPricing}</p>
              <p className="text-muted-foreground mt-1">{phase.notes}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-1 pr-2">Component</th>
                  <th className="py-1 pr-2">Provider</th>
                  <th className="py-1 pr-2">Free / included</th>
                  <th className="py-1 pr-2">Unit cost</th>
                  <th className="py-1 pr-2">Bottleneck</th>
                  <th className="py-1 pr-2">Migrate when</th>
                  <th className="py-1">Next cost</th>
                </tr>
              </thead>
              <tbody>
                {phase.rows.map((row) => (
                  <tr
                    key={`${phase.id}-${row.component}`}
                    className="border-b border-border/40 align-top"
                  >
                    <td className="py-1.5 pr-2 font-medium">{row.component}</td>
                    <td className="py-1.5 pr-2">{row.provider}</td>
                    <td className="py-1.5 pr-2">{row.freeOrIncluded}</td>
                    <td className="py-1.5 pr-2">{row.unitCost}</td>
                    <td className="py-1.5 pr-2">{row.bottleneck}</td>
                    <td className="py-1.5 pr-2">{row.migrationTrigger}</td>
                    <td className="py-1.5">
                      {row.nextStageCost}
                      <span className="text-muted-foreground block break-all">
                        {row.source}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ))}
    </div>
  );
}
