"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { UpgradePrompt } from "@/components/dashboard/upgrade-prompt";

type BillingCurrency = "USD" | "INR";

type PlanRow = {
  planId: string;
  name: string;
  priceUsdMonthly: number;
  priceInrMonthly?: number;
  priceLabel: string;
  aiCreditsPerMonth: number;
  conversationsPerMonth: number;
  websites: number;
  websitePagesPerSync: number;
  websitePagesPerMonth: number;
  classQuotas?: { simple: number; standard: number; complex: number };
};

type BillingPayload = {
  region?: { country: string | null; currency: BillingCurrency };
  plans: PlanRow[];
  subscription: {
    status: string;
    plan: string;
    planName: string;
    priceUsdMonthly: number;
    priceInrMonthly?: number;
    priceLabel: string;
    billingCycle: "monthly";
    paymentProvider: string | null;
    paymentMethodSummary: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    entitlements: PlanRow & Record<string, unknown>;
  } | null;
  allowance: {
    aiCredits: {
      ok: boolean;
      used: number;
      limit: number;
      remaining?: number;
      onDemandUsed?: number;
    };
    proactive: { ok: boolean; used: number; limit: number };
    workloads?: {
      simple: { used: number; limit: number; remaining: number; ok: boolean };
      standard: { used: number; limit: number; remaining: number; ok: boolean };
      complex: { used: number; limit: number; remaining: number; ok: boolean };
    };
  };
  policy?: { hardCap: boolean; onDemand: boolean };
  blocked?: { reason: string } | null;
  suggestedUpgrade: string | null;
  invoices: Array<{
    id: string;
    provider: string;
    eventType: string;
    amountCents: number | null;
    currency: string | null;
    createdAt: string | null;
  }>;
};

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="block text-[0.6rem] tracking-[0.16em] uppercase opacity-60">
      {children}
    </span>
  );
}

function plural(count: number, noun: string): string {
  if (count === 1) return `1 ${noun}`;
  const suffix = /(s|sh|ch|x|z)$/.test(noun) ? "es" : "s";
  return `${count.toLocaleString()} ${noun}${suffix}`;
}

function monthlyPriceLabel(
  usd: number,
  inr: number | undefined,
  currency: BillingCurrency,
): string {
  if (currency === "INR") {
    const amount = inr ?? 0;
    return amount === 0 ? "₹0" : `₹${amount.toLocaleString("en-IN")}/mon`;
  }
  return usd === 0 ? "$0" : `$${usd.toLocaleString()}/mon`;
}

/** Browser fallback when the CDN country header is absent (local / self-hosted). */
function browserLooksIndian(): boolean {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    if (zone === "Asia/Kolkata" || zone === "Asia/Calcutta") return true;
    return (navigator.language ?? "").toLowerCase().endsWith("-in");
  } catch {
    return false;
  }
}

export function BillingPanel({ embedded = false }: { embedded?: boolean }) {
  const searchParams = useSearchParams();
  const highlightPlan = searchParams.get("upgrade");
  const checkoutState = searchParams.get("checkout");

  const [data, setData] = useState<BillingPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [provider, setProvider] = useState<"stripe" | "razorpay">("stripe");
  const [providerTouched, setProviderTouched] = useState(false);
  const [currency, setCurrency] = useState<BillingCurrency>("USD");

  const load = useCallback(async () => {
    const res = await fetch("/api/v1/billing");
    const json = (await res.json()) as {
      success: boolean;
      data?: BillingPayload;
      error?: string;
    };
    if (json.success && json.data) setData(json.data);
    else setMessage(json.error ?? "Failed to load billing");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const india =
      data?.region?.currency === "INR" ||
      (!data?.region?.country && browserLooksIndian());
    setCurrency(india ? "INR" : "USD");
    if (!providerTouched) setProvider(india ? "razorpay" : "stripe");
  }, [data?.region?.currency, data?.region?.country, providerTouched]);

  useEffect(() => {
    if (checkoutState === "success") {
      setMessage(
        "Checkout completed in the payment provider. Your plan updates after the webhook confirms payment.",
      );
    } else if (checkoutState === "cancel") {
      setMessage("Checkout was cancelled. Your plan was not changed.");
    }
  }, [checkoutState]);

  const checkout = async (planId: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkout",
          planId,
          provider,
          localeHint: provider === "razorpay" ? "in" : "us",
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { checkoutUrl?: string; note?: string };
        error?: string;
      };
      if (!json.success) throw new Error(json.error ?? "Checkout failed");
      if (json.data?.checkoutUrl) {
        window.location.href = json.data.checkoutUrl;
        return;
      }
      setMessage(json.data?.note ?? "Checkout started.");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!confirm("Cancel paid plan and move to Free?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error ?? "Cancel failed");
      setMessage("Subscription cancelled. You are on Free.");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setBusy(false);
    }
  };

  const sub = data?.subscription;
  const credits = data?.allowance.aiCredits;
  const ent = sub?.entitlements;

  const usageRatio = useMemo(() => {
    if (!credits || credits.limit <= 0) return 0;
    return credits.used / credits.limit;
  }, [credits]);

  const planActionLabel = (planId: string) => {
    if (!sub) return planId === "free" ? "Select" : "Upgrade";
    if (sub.plan === planId) return "Current";
    const order = ["free", "starter", "pro", "business"];
    const cur = order.indexOf(sub.plan);
    const next = order.indexOf(planId);
    if (next < cur) return "Downgrade";
    return "Upgrade";
  };

  return (
    <div className="space-y-10">
      {embedded ? null : (
        <header className="space-y-2">
          <h1 className="text-3xl sm:text-4xl">Billing</h1>
          <p className="caption text-sm max-w-2xl">
            Manage your subscription here. Plan changes and paid entitlements
            are confirmed server-side via Stripe or Razorpay webhooks — never
            from the browser alone.
          </p>
        </header>
      )}

      {message ? (
        <p className="caption text-sm ink-card bg-[var(--cream)] px-4 py-3">
          {message}
        </p>
      ) : null}

      {usageRatio >= 0.85 && sub && sub.plan !== "business" ? (
        <UpgradePrompt
          title={`You’re using ${Math.round(usageRatio * 100)}% of your included AI credits`}
          detail={`Upgrade for more included AI credits. Suggested: ${
            data?.suggestedUpgrade
              ? String(data.suggestedUpgrade)
              : "a higher plan"
          }.`}
          ctaLabel={
            data?.suggestedUpgrade
              ? `Upgrade to ${data.suggestedUpgrade}`
              : "View plans"
          }
          href={
            data?.suggestedUpgrade
              ? `/dashboard/settings?section=billing&upgrade=${data.suggestedUpgrade}`
              : "/dashboard/settings?section=billing"
          }
          compact
        />
      ) : null}

      {/* Current subscription */}
      <section className="ink-card p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <SectionLabel>Current plan</SectionLabel>
            <h2 className="text-3xl font-medium">
              {sub?.planName ?? "No plan"}
            </h2>
            <p className="text-sm">
              {sub
                ? monthlyPriceLabel(
                    sub.priceUsdMonthly,
                    sub.priceInrMonthly,
                    currency,
                  )
                : "—"}
            </p>
          </div>
          {sub ? (
            <span className="sticker bg-[var(--cream)] capitalize">
              {sub.status.replace("_", " ")}
            </span>
          ) : null}
        </div>

        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <dt className="caption">Renewal / period end</dt>
            <dd className="mt-1">
              {sub?.currentPeriodEnd
                ? new Date(sub.currentPeriodEnd).toLocaleDateString()
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="caption">Period start</dt>
            <dd className="mt-1">
              {sub?.currentPeriodStart
                ? new Date(sub.currentPeriodStart).toLocaleDateString()
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="caption">Payment method</dt>
            <dd className="mt-1">
              {sub?.paymentMethodSummary ?? "Not on file (Free / unpaid)"}
            </dd>
          </div>
          <div>
            <dt className="caption">Provider</dt>
            <dd className="mt-1 capitalize">{sub?.paymentProvider ?? "—"}</dd>
          </div>
        </dl>

        {sub && sub.plan !== "free" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void cancel()}
            className="btn-ink bg-white px-4 py-2 text-xs"
          >
            Cancel & move to Free
          </button>
        ) : null}
      </section>

      {/* Included limits vs usage */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="ink-card p-6 space-y-3">
          <SectionLabel>Included limits</SectionLabel>
          <ul className="space-y-2 text-sm">
            <li>
              {ent?.aiCreditsPerMonth?.toLocaleString() ?? "—"} included AI
              credits / month
            </li>
            <li>
              {data?.policy?.onDemand
                ? "Metered credit overage after the included pool is exhausted"
                : "No on-demand billing; usage stops at the included pool"}
            </li>
            <li>{ent ? plural(ent.websites, "website") : "—"}</li>
            <li>
              {ent ? plural(ent.websitePagesPerSync, "website page") : "—"} /
              crawl
            </li>
            <li>
              {ent ? plural(ent.websitePagesPerMonth, "refresh") : "—"} / month
            </li>
          </ul>
        </div>
        <div className="ink-card p-6 space-y-4">
          <SectionLabel>Usage this period</SectionLabel>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Included AI credits</span>
              <span className="tabular-nums">
                {credits?.used ?? 0} / {credits?.limit ?? "—"}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--cream)] overflow-hidden border border-[var(--ink)]/10">
              <div
                className="h-full"
                style={{
                  width: `${Math.min(100, Math.round(usageRatio * 100))}%`,
                  background:
                    usageRatio >= 0.9
                      ? "var(--red)"
                      : usageRatio >= 0.75
                        ? "var(--yellow)"
                        : "var(--ink)",
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Plan catalog */}
      <section id="billing-plans-section" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl">Available plans</h2>
          <label className="caption text-xs flex items-center gap-2">
            Payment provider
            <select
              className="rounded-full border border-[var(--ink)] bg-white px-3 py-1"
              value={provider}
              onChange={(e) => {
                setProviderTouched(true);
                setProvider(e.target.value as "stripe" | "razorpay");
              }}
            >
              <option value="stripe">Stripe (international)</option>
              <option value="razorpay">Razorpay (India)</option>
            </select>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
          {(data?.plans ?? []).map((plan) => {
            const isCurrent = sub?.plan === plan.planId;
            const highlighted = highlightPlan === plan.planId;
            return (
              <div
                key={plan.planId}
                data-plan-card={plan.planId}
                className="ink-card p-5 rounded-2xl flex h-full flex-col gap-3"
                style={{
                  background:
                    isCurrent || highlighted ? "var(--cream)" : "white",
                  outline: highlighted ? "3px solid var(--blue)" : undefined,
                }}
              >
                <p className="text-[0.6rem] tracking-[0.16em] uppercase opacity-60">
                  {plan.name}
                  {isCurrent ? " · current" : ""}
                </p>
                <p className="text-3xl font-medium">
                  {monthlyPriceLabel(
                    plan.priceUsdMonthly,
                    plan.priceInrMonthly,
                    currency,
                  )}
                </p>
                <p className="text-lg font-medium tabular-nums">
                  {(plan.aiCreditsPerMonth ?? 0).toLocaleString()}{" "}
                  <span className="text-sm font-normal opacity-70">
                    included credits
                  </span>
                </p>
                <ul className="caption text-xs space-y-1 flex-1">
                  <li>{plural(plan.websites, "website")}</li>
                  <li>{plural(plan.websitePagesPerSync, "website page")}</li>
                  <li>
                    {plural(plan.websitePagesPerMonth, "refresh")} / month
                  </li>
                </ul>
                <button
                  type="button"
                  disabled={busy || isCurrent}
                  onClick={() =>
                    plan.planId === "free"
                      ? void cancel()
                      : void checkout(plan.planId)
                  }
                  className="btn-ink bg-[var(--ink)] text-white px-4 py-2 text-xs w-full disabled:opacity-40"
                >
                  {planActionLabel(plan.planId)}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* History */}
      <section className="ink-card p-6 space-y-3">
        <h2 className="text-xl">Billing history</h2>
        {(data?.invoices ?? []).length === 0 ? (
          <p className="caption text-sm">
            Invoices and payment events will appear here after checkout.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--ink)] border-t border-[var(--ink)]">
            {data!.invoices.map((inv) => (
              <li
                key={inv.id}
                className="py-3 flex flex-wrap justify-between gap-2 text-sm"
              >
                <span>
                  {inv.eventType} · {inv.provider}
                </span>
                <span className="caption text-xs">
                  {inv.amountCents != null
                    ? `${(inv.amountCents / 100).toFixed(2)} ${inv.currency ?? ""}`
                    : "—"}
                  {inv.createdAt
                    ? ` · ${new Date(inv.createdAt).toLocaleString()}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
