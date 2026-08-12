import { eq } from "drizzle-orm";
import { db, widgetConfigs } from "@neylonai/database";
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
    },
  });
  return persistWidgetConfig(organizationId, next);
}
