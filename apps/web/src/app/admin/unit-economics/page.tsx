import { requireAdmin } from "@/server/auth-guards";
import {
  PLAN_CATALOG,
  WORKLOAD_BUDGET_LIST,
  TOKEN_PLANNING_ASSUMPTIONS,
  AI_CREDIT_COSTS,
  AI_CREDITS_INCLUDED_BY_PLAN,
  PLAN_CLASS_QUOTAS,
  type AiCreditClass,
  type PlanId,
} from "@neylonai/domain/billing";
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

const CAPACITY_CASES = [
  {
    rpm: "10 RPM",
    latency: "6s average",
    inFlight: "≈1 average",
    provision: "3–4 concurrent",
    note: "Small production workspace; idle baseline usually dominates compute.",
  },
  {
    rpm: "30 RPM",
    latency: "8s average",
    inFlight: "≈4 average",
    provision: "8–12 concurrent",
    note: "Mixed Simple/Standard; Complex 30-chunk turns raise p95 latency.",
  },
  {
    rpm: "60 RPM",
    latency: "10s average",
    inFlight: "≈10 average",
    provision: "18–24 concurrent",
    note: "Starter plan ceiling; watch Gemini context size, Postgres pool, and sockets.",
  },
] as const;

const INFRA_CASES = [
  {
    requests: "1,000 / month",
    allocation: "$0.020 / request",
    note: "Low utilization: a $20 monthly app allocation is mostly idle.",
  },
  {
    requests: "10,000 / month",
    allocation: "$0.002 / request",
    note: "Moderate utilization; compute starts approaching model/API cost.",
  },
  {
    requests: "100,000 / month",
    allocation: "$0.0002 / request",
    note: "Well utilized; provider APIs usually dominate per-request COGS.",
  },
] as const;

const BASE_INPUT_TOKENS_APPROX =
  TOKEN_PLANNING_ASSUMPTIONS.systemPromptTokensApprox +
  TOKEN_PLANNING_ASSUMPTIONS.historyTurns *
    TOKEN_PLANNING_ASSUMPTIONS.historyTokensPerTurnApprox +
  TOKEN_PLANNING_ASSUMPTIONS.newQueryTokensApprox;

const INPUT_USD_PER_1M: Record<AiCreditClass, number> = {
  simple: 0.25,
  standard: 0.3,
  complex: 1.5,
};

const OUTPUT_USD_PER_1M: Record<AiCreditClass, number> = {
  simple: 1.5,
  standard: 2.5,
  complex: 7.5,
};

/** Average visible reply size used for Workload budgets planning. */
const AVG_OUTPUT_TOKENS: Record<AiCreditClass, number> = {
  simple: 500,
  standard: 1_200,
  complex: 2_500,
};

/**
 * Non-LLM all-in adders per request: embeddings, query expansion (std/complex),
 * classifier, Postgres vector/SQL, shared app compute, storage share.
 * High includes one metered web search on Standard/Complex.
 */
const NON_MODEL_OVERHEAD_USD: Record<
  AiCreditClass,
  { typical: number; high: number }
> = {
  simple: { typical: 0.0015, high: 0.003 },
  standard: { typical: 0.003, high: 0.012 },
  complex: { typical: 0.005, high: 0.015 },
};

/** One credit covers the doubled typical cost of one Simple request. */
/**
 * Shared-wallet spend and grants come from `@neylonai/domain/billing`
 * (Simple 1 · Standard 2 · Complex 8; Free 500 · Starter 2k · Pro 5k · Business 15k).
 */

const workloadRows = WORKLOAD_BUDGET_LIST.map((row) => {
  const plannedInputTokensMax =
    BASE_INPUT_TOKENS_APPROX * 2 + row.ragTokensApprox;
  const avgOutputTokensApprox = AVG_OUTPUT_TOKENS[row.id];
  const modelCogsUsd =
    (plannedInputTokensMax * INPUT_USD_PER_1M[row.id]) / 1_000_000 +
    (avgOutputTokensApprox * OUTPUT_USD_PER_1M[row.id]) / 1_000_000;
  const overhead = NON_MODEL_OVERHEAD_USD[row.id];
  const actualCogsUsd = {
    typical: modelCogsUsd + overhead.typical,
    high: modelCogsUsd + overhead.high,
  };

  return {
    ...row,
    credits: AI_CREDIT_COSTS[row.id],
    plannedInputTokensMax,
    avgOutputTokensApprox,
    modelCogsUsd,
    actualCogsUsd,
  };
});

const workloadRowsById = Object.fromEntries(
  workloadRows.map((row) => [row.id, row]),
) as Record<AiCreditClass, (typeof workloadRows)[number]>;

function formatPlanningMix(quotas: Record<AiCreditClass, number>): string {
  const total = quotas.simple + quotas.standard + quotas.complex;
  return `${quotas.simple.toLocaleString()} Simple · ${quotas.standard.toLocaleString()} Standard · ${quotas.complex.toLocaleString()} Complex (${total.toLocaleString()} total max)`;
}

function quotaInputTokensApprox(quotas: Record<AiCreditClass, number>): number {
  return workloadRows.reduce(
    (total, row) => total + quotas[row.id] * row.plannedInputTokensMax,
    0,
  );
}

function quotaRagInputTokensApprox(
  quotas: Record<AiCreditClass, number>,
): number {
  return workloadRows.reduce(
    (total, row) => total + quotas[row.id] * row.ragTokensApprox,
    0,
  );
}

function cogsAtQuotaMixUsd(
  quotas: Record<AiCreditClass, number>,
  useHighEstimate: boolean,
): number {
  return (Object.keys(quotas) as AiCreditClass[]).reduce((total, workload) => {
    const actual = workloadRowsById[workload].actualCogsUsd;
    return (
      total +
      quotas[workload] * (useHighEstimate ? actual.high : actual.typical)
    );
  }, 0);
}

function money(n: number, digits = 2): string {
  const abs = Math.abs(n);
  const formatted =
    abs >= 10 ? n.toFixed(0) : abs >= 1 ? n.toFixed(2) : n.toFixed(digits);
  return n < 0 ? `-$${formatted.replace("-", "")}` : `$${formatted}`;
}

function tokenCount(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(n >= 10_000 ? 1 : 2)}k`;
  }
  return n.toLocaleString();
}

export default async function AdminUnitEconomicsPage() {
  await requireAdmin();

  const planRpm = Object.values(PLAN_CATALOG).map((plan) => ({
    plan: plan.name,
    rpm: plan.apiRequestsPerMinute,
  }));

  const planRows = (Object.keys(PLAN_CATALOG) as PlanId[]).map((planId) => {
    const plan = PLAN_CATALOG[planId];
    const creditGrant = AI_CREDITS_INCLUDED_BY_PLAN[planId];
    const quotas = PLAN_CLASS_QUOTAS[planId];
    const totalQueries = quotas.simple + quotas.standard + quotas.complex;
    const expected = cogsAtQuotaMixUsd(quotas, false);
    const max = cogsAtQuotaMixUsd(quotas, true);
    const profit = plan.priceUsdMonthly - expected;
    const worst = plan.priceUsdMonthly - max;
    const fullInputTokens = quotaInputTokensApprox(quotas);
    const baseContextTokens =
      fullInputTokens - quotaRagInputTokensApprox(quotas);
    return {
      plan: plan.name,
      price: plan.priceUsdMonthly === 0 ? "$0" : `$${plan.priceUsdMonthly}`,
      credits: creditGrant.toLocaleString(),
      classQuotas: formatPlanningMix(quotas),
      totalQueries,
      inputTokens: `≈${tokenCount(fullInputTokens)} (+${tokenCount(baseContextTokens)} base context)`,
      fullInputTokens,
      overage: plan.onDemandBilling ? "Shared wallet → metered" : "None",
      expectedCogs: `~${money(expected)}`,
      maxCogs: money(max),
      profit:
        plan.priceUsdMonthly === 0
          ? `${money(profit)} (worst ${money(worst)})`
          : `~${money(profit)} (worst ≥${money(worst)})`,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Unit Economics</h1>
      </div>

      <Section title="Workload budgets">
        <div className="-mx-1 overflow-x-auto pb-1">
          <table className="w-max min-w-full border-collapse text-left text-xs">
            <thead>
              <tr className="text-muted-foreground border-b">
                <th className="sticky left-0 z-10 bg-background py-2 pr-4 whitespace-nowrap">
                  Workload
                </th>
                <th className="py-2 pr-4 whitespace-nowrap">Credits</th>
                <th className="py-2 pr-4 whitespace-nowrap">Model</th>
                <th className="py-2 pr-4 whitespace-nowrap">Evidence to model</th>
                <th className="py-2 pr-4 whitespace-nowrap">
                  Planned input tokens
                </th>
                <th className="py-2 pr-4 whitespace-nowrap">Avg output</th>
                <th className="py-2 pr-4 whitespace-nowrap">
                  Actual cost / request
                </th>
                <th className="py-2 pr-4 whitespace-nowrap">
                  2× actual cost
                </th>
                <th className="py-2 whitespace-nowrap">Latency</th>
              </tr>
            </thead>
            <tbody>
              {workloadRows.map((row) => (
                <tr key={row.id} className="border-border/50 border-b">
                  <td className="sticky left-0 z-10 bg-background py-2 pr-4 font-semibold whitespace-nowrap">
                    {row.name}
                  </td>
                  <td className="py-2 pr-4 font-semibold tabular-nums whitespace-nowrap">
                    {row.credits}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {row.modelLabel}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    ≈{row.ragTokensApprox.toLocaleString()} RAG+DB · either
                    alone OK · leftover → extra knowledge · DB{" "}
                    {row.databaseRows} rows / {row.databaseTimeoutSeconds}s
                  </td>
                  <td className="py-2 pr-4 tabular-nums whitespace-nowrap">
                    ≈{row.plannedInputTokensMax.toLocaleString()} max ·{" "}
                    {TOKEN_PLANNING_ASSUMPTIONS.systemPromptTokensApprox.toLocaleString()}
                    ×2 +{" "}
                    {(
                      TOKEN_PLANNING_ASSUMPTIONS.historyTurns *
                      TOKEN_PLANNING_ASSUMPTIONS.historyTokensPerTurnApprox
                    ).toLocaleString()}
                    ×2 +{" "}
                    {TOKEN_PLANNING_ASSUMPTIONS.newQueryTokensApprox.toLocaleString()}
                    ×2 + {row.ragTokensApprox.toLocaleString()} evidence
                  </td>
                  <td className="py-2 pr-4 tabular-nums whitespace-nowrap">
                    ≈{row.avgOutputTokensApprox.toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 tabular-nums whitespace-nowrap">
                    ~{money(row.actualCogsUsd.typical, 4)} · model ~
                    {money(row.modelCogsUsd, 4)} · high ~
                    {money(row.actualCogsUsd.high, 4)}
                  </td>
                  <td className="py-2 pr-4 font-semibold tabular-nums whitespace-nowrap">
                    ~{money(row.actualCogsUsd.typical * 2, 4)} · high ~
                    {money(row.actualCogsUsd.high * 2, 4)}
                  </td>
                  <td className="py-2 whitespace-nowrap">{row.latency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Recommended shared credit wallet">
        <p className="text-muted-foreground text-xs">
          Every request spends from one shared balance: Simple 1 · Standard 2 ·
          Complex 8. Plan grants are rounded: Free 500 · Starter 2,000 · Pro
          5,000 · Business 15,000. Query limits allow one-way borrowing:
          Simple→Standard→Complex and Standard→Complex. Complex never borrows
          downward; exhausted routes use Simple runtime limits.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-xs">
            <thead>
              <tr className="text-muted-foreground border-b">
                <th className="py-2 pr-3">Plan</th>
                <th className="py-2 pr-3">Price</th>
                <th className="py-2 pr-3">Shared credits</th>
                <th className="py-2 pr-3">
                  Max queries (Simple / Standard / Complex)
                </th>
                <th className="py-2 pr-3">Input tokens at quota mix</th>
                <th className="py-2 pr-3">Credit overage</th>
                <th className="py-2 pr-3">Quota-mix actual COGS</th>
                <th className="py-2 pr-3">Quota-mix high COGS</th>
                <th className="py-2">Gross profit</th>
              </tr>
            </thead>
            <tbody>
              {planRows.map((row) => (
                <tr key={row.plan} className="border-border/50 border-b">
                  <td className="py-2 pr-3 font-semibold">{row.plan}</td>
                  <td className="py-2 pr-3 tabular-nums">{row.price}</td>
                  <td className="py-2 pr-3 font-semibold tabular-nums">
                    {row.credits}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {row.classQuotas}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">
                    {row.inputTokens}
                  </td>
                  <td className="py-2 pr-3">{row.overage}</td>
                  <td className="py-2 pr-3 tabular-nums">
                    {row.expectedCogs}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{row.maxCogs}</td>
                  <td className="py-2 font-semibold tabular-nums">
                    {row.profit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground text-xs">
          Hard class limits total:{" "}
          {planRows
            .map((row) => `${row.plan} ${row.totalQueries.toLocaleString()}`)
            .join(" · ")}
          . Planned input at this mix:{" "}
          {planRows
            .map(
              (row) => `${row.plan} ≈${tokenCount(row.fullInputTokens)}`,
            )
            .join(" · ")}
          .
        </p>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Concurrency and RPM">
          <p className="text-muted-foreground text-xs">
            Average in-flight requests follow Little&apos;s Law: RPM × average
            latency ÷ 60. Provision above the average for bursts; most request
            time waits on Gemini, Postgres, or external APIs rather than CPU.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="py-2 pr-2">Traffic</th>
                  <th className="py-2 pr-2">Average</th>
                  <th className="py-2 pr-2">In flight</th>
                  <th className="py-2">Provision</th>
                </tr>
              </thead>
              <tbody>
                {CAPACITY_CASES.map((row) => (
                  <tr key={row.rpm} className="border-border/50 border-b">
                    <td className="py-2 pr-2 font-semibold">{row.rpm}</td>
                    <td className="py-2 pr-2">{row.latency}</td>
                    <td className="py-2 pr-2">{row.inFlight}</td>
                    <td className="py-2">
                      {row.provision}
                      <span className="text-muted-foreground mt-0.5 block">
                        {row.note}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground text-xs">
            Plan API gates:{" "}
            {planRpm.map((row, index) => (
              <span key={row.plan}>
                {index > 0 ? " · " : ""}
                {row.plan} {row.rpm} RPM
              </span>
            ))}
            . These are tenant limits, not proof that one web instance can
            sustain their combined maximum.
          </p>
        </Section>

        <Section title="Shared compute and idle-time allocation">
          <p className="text-muted-foreground text-xs">
            Example only: spreading a $20/month application compute allocation
            across actual request volume. At low traffic, idle hosting costs
            more per request than active CPU; at higher utilization that fixed
            amount becomes small.
          </p>
          <div className="space-y-2">
            {INFRA_CASES.map((row) => (
              <div
                key={row.requests}
                className="border-border/60 rounded border p-3 text-xs"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{row.requests}</span>
                  <span className="font-mono tabular-nums">
                    {row.allocation}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1">{row.note}</p>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            Track p50/p95 latency, active requests, event-loop lag, database
            pool saturation, provider 429s, and COGS/request before changing
            concurrency or RPM limits.
          </p>
        </Section>
      </div>
    </div>
  );
}
