import { count, eq } from "drizzle-orm";
import { db, knowledgeDocuments, threads } from "@neylonai/database";
import {
  countProductMetric,
  getOrgCreditSummary,
  getPlanEntitlements,
  getPublishableKeyForOrg,
  getSubscriptionForOrg,
  isSubscriptionEligible,
  listApiKeysForOrg,
  normalizeSubscriptionStatus,
  formatPlanPrice,
  buildUsageUpgradePrompt,
  type PlanEntitlements,
  type UpgradePromptContent,
} from "@neylonai/domain/billing";
import {
  DEFAULT_WIDGET_CONFIG,
  getWidgetConfigForOrg,
  type StoredWidgetConfig,
} from "@/server/widget-config";
import type { OrgSession } from "@/server/auth-guards";

export type OverviewAlert = {
  id: string;
  tone: "warning" | "critical";
  title: string;
  detail: string;
  href: string;
  actionLabel: string;
};

export type OverviewChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  href: string;
};

export type OverviewActivityItem = {
  id: string;
  label: string;
  meta: string;
  at: Date | null;
  href?: string;
};

export type DashboardOverviewData = {
  member: {
    firstName: string;
    organizationName: string;
    organizationSlug: string;
  };
  chatbotStatus: {
    working: boolean;
    label: "Active" | "Needs attention" | "Inactive";
    detail: string;
  };
  widget: {
    name: string;
    proactiveEnabled: boolean;
    activeKey: boolean;
    domains: string[];
    lastSeenAt: Date | null;
    lastSeenLabel: string;
  };
  conversations: {
    total: number;
    awaitingHuman: number;
  };
  /** Ready-to-paste install snippet for the Overview card. */
  install: {
    /**
     * The org's publishable key in plaintext when one exists and is retrievable.
     * Null when the org has no key yet (lazy — user hasn't copied) or the key
     * predates the retrievable-key column; the Copy button mints/handles both.
     */
    publishableKey: string | null;
  };
  metrics: {
    aiCreditsUsed: number;
    aiCreditsLimit: number;
    aiCreditsRemaining: number;
    planName: string;
    planId: string;
    planPriceLabel: string;
    billingCycle: "monthly";
    subscriptionStatus: string;
  };
  usageUpgrade: UpgradePromptContent | null;
  proactive: {
    enabled: boolean;
    activityCount: number;
  };
  activity: OverviewActivityItem[];
  checklist: OverviewChecklistItem[];
  setupComplete: boolean;
  alerts: OverviewAlert[];
  primaryAction: {
    label: string;
    href: string;
    reason: string;
  };
  entitlements: PlanEntitlements;
};

function formatRelative(date: Date | null): string {
  if (!date) return "Never";
  const ms = Date.now() - date.getTime();
  if (ms < 60_000) return "Just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  if (ms < 7 * 86_400_000) return `${Math.floor(ms / 86_400_000)}d ago`;
  return date.toLocaleDateString();
}

function brandingCustomized(config: StoredWidgetConfig): boolean {
  const name = config.branding?.name?.trim();
  const color = config.branding?.primaryTextColor?.trim();
  const defaultName = DEFAULT_WIDGET_CONFIG.branding?.name;
  const defaultColor = DEFAULT_WIDGET_CONFIG.branding?.primaryTextColor;
  if (name && name !== defaultName) return true;
  if (color && color !== defaultColor) return true;
  return false;
}

export async function loadDashboardOverview(
  member: OrgSession,
): Promise<DashboardOverviewData> {
  const organizationId = member.organizationId;
  let totalConversations = 0;
  let awaitingHuman = 0;
  try {
    const threadRows = await db
      .select({
        status: threads.conversation_status,
        c: count(),
      })
      .from(threads)
      .where(eq(threads.organization_id, organizationId))
      .groupBy(threads.conversation_status);
    
    for (const r of threadRows) {
      totalConversations += Number(r.c);
      if (r.status === "human_pending" || r.status === "human_active") {
         awaitingHuman += Number(r.c);
      }
    }
  } catch {}

  const [subscription, config, keys, publishableKey] = await Promise.all([
    getSubscriptionForOrg(organizationId),
    getWidgetConfigForOrg(organizationId),
    listApiKeysForOrg(organizationId),
    getPublishableKeyForOrg(organizationId),
  ]);

  const entitlements = getPlanEntitlements(subscription?.plan);
  const periodStart =
    subscription?.current_period_start ??
    new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const status = normalizeSubscriptionStatus(subscription?.status ?? "inactive");
  const eligible = isSubscriptionEligible(status);

  const activeKeys = keys.filter((k) => !k.revokedAt);
  const primaryKey = activeKeys[0] ?? null;
  const domains = (primaryKey?.allowedOrigins ?? []).filter(Boolean);
  const lastSeenAt = primaryKey?.lastUsedAt
    ? new Date(primaryKey.lastUsedAt)
    : null;

  let docCount = 0;
  try {
    const [row] = await db
      .select({ n: count() })
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.organization_id, organizationId));
    docCount = Number(row?.n ?? 0);
  } catch {
    docCount = 0;
  }

  const creditSummary = await getOrgCreditSummary(organizationId);
  const creditLimit =
    creditSummary.granted > 0
      ? creditSummary.granted
      : entitlements.aiCreditsPerMonth;
  const creditAllowance = {
    used: creditSummary.includedUsed,
    limit: creditLimit,
    remaining: creditSummary.available,
    totalUsed: creditSummary.totalUsed,
    blocked: creditSummary.blocked,
  };

  let proactiveActivity = 0;
  try {
    proactiveActivity = await countProductMetric(
      organizationId,
      "proactive_refresh",
      periodStart,
    );
  } catch {
    proactiveActivity = 0;
  }

  const activity: OverviewActivityItem[] = [];
  if (creditAllowance.totalUsed > 0) {
    activity.push({
      id: "ai_credits",
      label: `${creditAllowance.totalUsed.toLocaleString()} AI credits used this period`,
      meta: `${creditAllowance.used} of ${creditAllowance.limit} included credits`,
      at: new Date(),
      href: "/dashboard/usage",
    });
  }
  if (proactiveActivity > 0) {
    activity.push({
      id: "proactive",
      label: `${proactiveActivity.toLocaleString()} proactive refreshes`,
      meta: "Suggestions",
      at: new Date(),
      href: "/dashboard/usage",
    });
  }

  const checklist: OverviewChecklistItem[] = [
    {
      id: "api_key",
      label: "Copy your install script",
      done: activeKeys.length > 0,
      href: "/dashboard/settings?section=developer",
    },
    {
      id: "customize",
      label: "Customize chatbot appearance",
      done: brandingCustomized(config),
      href: "/dashboard/widget",
    },
    {
      id: "knowledge",
      label: "Add website or database knowledge",
      done: docCount > 0,
      href: "/dashboard/integrations",
    },
    {
      id: "embed",
      label: "Connect the widget on your site",
      done: Boolean(lastSeenAt),
      href: "/dashboard/settings?section=developer",
    },
  ];

  const setupComplete = checklist.every((c) => c.done);
  const alerts: OverviewAlert[] = [];

  // no_key alert removed as requested

  if (!eligible) {
    alerts.push({
      id: "subscription",
      tone: "critical",
      title: "Subscription not active",
      detail: `Status is “${status}”. Chatbot requests are blocked until billing is fixed.`,
      href: "/dashboard/settings?section=billing",
      actionLabel: "Open billing",
    });
  }

  const usageRatio =
    creditAllowance.limit > 0
      ? creditAllowance.used / creditAllowance.limit
      : 0;
  const usageUpgrade = buildUsageUpgradePrompt(subscription?.plan, {
    used: creditAllowance.used,
    limit: creditAllowance.limit,
    metricLabel: "included AI credits",
  });

  if (eligible && usageRatio >= 0.9) {
    alerts.push({
      id: "usage_limit",
      tone: "warning",
      title: "Most included AI credits used",
      detail: `${creditAllowance.used} of ${creditAllowance.limit} included credits used. Chat uses a shared wallet (Simple 1 · Standard 2 · Complex 8); paid plans continue as metered overage after the pool is exhausted.`,
      href: "/dashboard/usage",
      actionLabel: "View usage",
    });
  } else if (eligible && usageRatio >= 0.75) {
    alerts.push({
      id: "usage_warn",
      tone: "warning",
      title: "Included AI credits running low",
      detail: `${creditAllowance.used} of ${creditAllowance.limit} included credits used this period.`,
      href: "/dashboard/usage",
      actionLabel: "View usage",
    });
  }

  if (activeKeys.length > 0 && !lastSeenAt) {
    alerts.push({
      id: "widget_undetected",
      tone: "warning",
      title: "Widget not detected yet",
      detail:
        "No API requests from your key yet. Add the install script to your website.",
      href: "/dashboard/settings?section=developer",
      actionLabel: "View install steps",
    });
  }

  let chatbotLabel: DashboardOverviewData["chatbotStatus"]["label"] = "Inactive";
  let chatbotDetail = "Chatbot is not ready to serve visitors.";
  let working = false;

  if (eligible && activeKeys.length > 0 && lastSeenAt) {
    working = true;
    chatbotLabel = "Active";
    chatbotDetail = `Serving visitors · last request ${formatRelative(lastSeenAt)}`;
  } else if (eligible && activeKeys.length > 0) {
    chatbotLabel = "Needs attention";
    chatbotDetail =
      "Key ready, but the widget has not been detected on a site yet.";
  } else if (eligible) {
    chatbotLabel = "Needs attention";
    chatbotDetail = "Subscription is fine — copy your install script to go live.";
  } else {
    chatbotLabel = "Inactive";
    chatbotDetail = `Subscription status: ${status}`;
  }

  if (alerts.some((a) => a.tone === "critical") && working) {
    chatbotLabel = "Needs attention";
  }

  const remainingChecklist = checklist.filter((c) => !c.done);
  const firstAlert = alerts[0];

  let primaryAction: DashboardOverviewData["primaryAction"];
  if (firstAlert?.tone === "critical") {
    primaryAction = {
      label: firstAlert.actionLabel,
      href: firstAlert.href,
      reason: firstAlert.title,
    };
  } else if (!setupComplete && remainingChecklist[0]) {
    primaryAction = {
      label: remainingChecklist[0].label,
      href: remainingChecklist[0].href,
      reason: "Finish setup so visitors get accurate answers.",
    };
  } else if (firstAlert) {
    primaryAction = {
      label: firstAlert.actionLabel,
      href: firstAlert.href,
      reason: firstAlert.title,
    };
  } else {
    primaryAction = {
      label: "Customize chatbot",
      href: "/dashboard/widget",
      reason: "Tune appearance and proactive suggestions.",
    };
  }

  return {
    member: {
      firstName: member.name.split(" ")[0] || "there",
      organizationName: member.organizationName,
      organizationSlug: member.organizationSlug,
    },
    chatbotStatus: {
      working,
      label: chatbotLabel,
      detail: chatbotDetail,
    },
    widget: {
      name: config.branding?.name?.trim() || "Neylon AI",
      proactiveEnabled: config.proactive?.enabled !== false,
      activeKey: activeKeys.length > 0,
      domains,
      lastSeenAt,
      lastSeenLabel: formatRelative(lastSeenAt),
    },
    conversations: {
      total: totalConversations,
      awaitingHuman,
    },
    install: {
      publishableKey,
    },
    metrics: {
      aiCreditsUsed: creditAllowance.used,
      aiCreditsLimit: creditAllowance.limit,
      aiCreditsRemaining: Math.max(
        0,
        creditAllowance.limit - creditAllowance.used,
      ),
      planName: entitlements.name,
      planId: entitlements.planId,
      planPriceLabel: formatPlanPrice(entitlements.planId),
      billingCycle: "monthly",
      subscriptionStatus: status,
    },
    usageUpgrade,
    proactive: {
      enabled: config.proactive?.enabled !== false,
      activityCount: proactiveActivity,
    },
    activity,
    checklist,
    setupComplete,
    alerts,
    primaryAction,
    entitlements,
  };
}
