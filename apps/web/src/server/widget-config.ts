import { eq } from "drizzle-orm";
import { db, widgetConfigs } from "@neylonai/database";
import { generateWidgetContent } from "@neylonai/domain/knowledge/widget-content";
import {
  BRANDING_COLORS_VERSION,
  DEFAULT_WIDGET_CONFIG,
  mergeWidgetConfig,
  brandingColorsNeedMigration,
  withPlatformBrandingColors,
  type StoredWidgetConfig,
} from "@/lib/widget-config-types";

export type { StoredWidgetConfig };
export { DEFAULT_WIDGET_CONFIG, mergeWidgetConfig };
export {
  shouldShowWidgetOnPath,
  shouldAutoOpenOnPath,
  pathMatchesPrefixes,
} from "@/lib/widget-config-types";

async function readRawWidgetConfig(
  organizationId: string,
): Promise<StoredWidgetConfig | null> {
  try {
    const [row] = await db
      .select()
      .from(widgetConfigs)
      .where(eq(widgetConfigs.organization_id, organizationId))
      .limit(1);
    if (!row?.config) return null;
    return row.config as StoredWidgetConfig;
  } catch {
    return null;
  }
}

async function persistWidgetConfig(
  organizationId: string,
  next: StoredWidgetConfig,
): Promise<StoredWidgetConfig> {
  const [existing] = await db
    .select({ id: widgetConfigs.id })
    .from(widgetConfigs)
    .where(eq(widgetConfigs.organization_id, organizationId))
    .limit(1);

  if (existing) {
    await db
      .update(widgetConfigs)
      .set({ config: next, updated_at: new Date() })
      .where(eq(widgetConfigs.id, existing.id));
  } else {
    await db.insert(widgetConfigs).values({
      organization_id: organizationId,
      config: next,
    });
  }

  return next;
}

/**
 * Seed home FAQs once with static defaults (or lock existing custom FAQs).
 * Does not pull from knowledge — users edit FAQs in the dashboard.
 */
async function maybeSeedDefaultFaqs(
  organizationId: string,
  raw: StoredWidgetConfig | null,
): Promise<StoredWidgetConfig | null> {
  if (raw?.messages?.faqsInitialized === true) return raw;

  const existingFaqs = Array.isArray(raw?.messages?.faqs)
    ? raw.messages.faqs
        .map((f) => ({
          question: typeof f?.question === "string" ? f.question.trim() : "",
          answer: typeof f?.answer === "string" ? f.answer.trim() : "",
        }))
        .filter((f) => f.question && f.answer)
        .slice(0, 4)
    : [];

  const faqs =
    existingFaqs.length > 0
      ? existingFaqs
      : [...(DEFAULT_WIDGET_CONFIG.messages?.faqs ?? [])];

  const locked = mergeWidgetConfig({
    ...(raw ?? {}),
    messages: {
      ...(raw?.messages ?? {}),
      faqs,
      faqsInitialized: true,
    },
  });
  try {
    await persistWidgetConfig(organizationId, locked);
  } catch {
    // still return locked for this request
  }
  return locked;
}

function absolutify(url?: string): string | undefined {
  if (!url) return url;
  if (url.startsWith("/")) {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://neylonai.mhrithik.com";
    return `${baseUrl}${url}`;
  }
  return url;
}

export async function getWidgetConfigForOrg(
  organizationId: string,
): Promise<StoredWidgetConfig> {
  const raw = await readRawWidgetConfig(organizationId);
  const afterSeed = await maybeSeedDefaultFaqs(organizationId, raw);
  let config = mergeWidgetConfig(afterSeed);

  // Old rows predate the current color roles (Ask fill, tab active/inactive,
  // transparent AI bubbles). Without this, refresh reloads stale values while
  // Reset shows the real platform palette.
  if (
    brandingColorsNeedMigration(raw) ||
    brandingColorsNeedMigration(afterSeed)
  ) {
    config = withPlatformBrandingColors(config);
    try {
      await persistWidgetConfig(organizationId, config);
    } catch {
      // still return migrated config for this request
    }
  }

  if (config.branding) {
    if (config.branding.logoUrl) {
      config.branding.logoUrl = absolutify(config.branding.logoUrl);
    }
    if (config.branding.font?.customFontUrl) {
      config.branding.font.customFontUrl = absolutify(config.branding.font.customFontUrl);
    }
  }
  return config;
}

export async function saveWidgetConfigForOrg(
  organizationId: string,
  patch: StoredWidgetConfig,
): Promise<StoredWidgetConfig> {
  const faqs = Array.isArray(patch.messages?.faqs)
    ? patch.messages.faqs
        .map((f) => ({
          question: typeof f?.question === "string" ? f.question.trim() : "",
          answer: typeof f?.answer === "string" ? f.answer.trim() : "",
        }))
        .filter((f) => f.question && f.answer)
        .slice(0, 4)
    : [];

  // Dashboard publish owns FAQs permanently (no further knowledge re-seed).
  // Stamp colorsVersion so the next public GET does not re-migrate over saved colors.
  const next = mergeWidgetConfig({
    ...patch,
    branding: {
      ...patch.branding,
      colorsVersion: Math.max(
        patch.branding?.colorsVersion ?? 0,
        BRANDING_COLORS_VERSION,
      ),
    },
    messages: {
      ...patch.messages,
      faqs,
      faqsInitialized: true,
      // A dashboard publish also permanently locks the messages block against
      // any future automatic AI re-seed.
      contentInitialized: true,
    },
  });
  return persistWidgetConfig(organizationId, next);
}

/**
 * One-time AI seed of the widget's content (messages) from the org's crawled
 * knowledge. Gated by the `contentInitialized` one-way lock so it runs at most
 * once and never overwrites a user's edits.
 *
 * Called from the onboarding wizard's "getting ready" step after the initial
 * crawl completes. The generated copy auto-publishes live with no review, so
 * the anti-fabrication guardrail lives in `generateWidgetContent`; here we only
 * merge + lock. Omitted generated fields fall back to the static defaults via
 * `mergeWidgetConfig`, and a null generation leaves the defaults unlocked so a
 * future re-crawl can retry.
 */
export async function seedWidgetContentFromKnowledge(
  organizationId: string,
): Promise<{ seeded: boolean }> {
  const raw = await readRawWidgetConfig(organizationId);
  if (raw?.messages?.contentInitialized === true) return { seeded: false };

  const generated = await generateWidgetContent(organizationId);
  if (!generated) return { seeded: false };

  const next = mergeWidgetConfig({
    ...(raw ?? {}),
    messages: {
      ...(raw?.messages ?? {}),
      ...generated,
      // Gate only on contentInitialized so AI content wins over any static FAQ
      // a stray dashboard/public read may have locked first — then set both.
      contentInitialized: true,
      faqsInitialized: true,
    },
  });
  await persistWidgetConfig(organizationId, next);
  return { seeded: true };
}
