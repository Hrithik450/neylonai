import { eq } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import {
  db,
  organizations,
  organizationWorkspaceSettings,
} from "@neylonai/database";
import {
  DEFAULT_NOTIFICATIONS,
  DEFAULT_PRIVACY,
  DEFAULT_SSO,
  type WorkspaceSettings,
  type WorkspaceSettingsPatch,
} from "./types";

function hashSecret(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function mapSettings(
  org: { id: string; name: string; slug: string },
  row: typeof organizationWorkspaceSettings.$inferSelect | null,
): WorkspaceSettings {
  return {
    organizationId: org.id,
    organizationName: org.name,
    organizationSlug: org.slug,
    customerFacingName: row?.customer_facing_name ?? null,
    logoUrl: row?.logo_url ?? null,
    timezone: row?.timezone ?? "UTC",
    defaultLanguage: row?.default_language ?? "en",
    notifications: {
      ...DEFAULT_NOTIFICATIONS,
      ...(row?.notifications ?? {}),
    },
    privacy: {
      ...DEFAULT_PRIVACY,
      ...(row?.privacy ?? {}),
    },
    sso: {
      ...DEFAULT_SSO,
      ...(row?.sso ?? {}),
    },
    webhookUrl: row?.webhook_url ?? null,
    webhookSecretLastFour: row?.webhook_secret_last_four ?? null,
    hasWebhookSecret: Boolean(row?.webhook_secret_hash),
  };
}

async function ensureWorkspaceRow(organizationId: string) {
  const [existing] = await db
    .select()
    .from(organizationWorkspaceSettings)
    .where(eq(organizationWorkspaceSettings.organization_id, organizationId))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(organizationWorkspaceSettings)
    .values({ organization_id: organizationId })
    .returning();
  return created;
}

export async function getWorkspaceSettings(
  organizationId: string,
): Promise<WorkspaceSettings> {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!org) throw new Error("Organization not found");

  try {
    const row = await ensureWorkspaceRow(organizationId);
    return mapSettings(org, row);
  } catch {
    // Table may not exist yet before migration — return org defaults.
    return mapSettings(org, null);
  }
}

export async function saveWorkspaceSettings(
  organizationId: string,
  patch: WorkspaceSettingsPatch,
): Promise<{ settings: WorkspaceSettings; webhookSecretOnce?: string }> {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!org) throw new Error("Organization not found");

  if (patch.organizationName?.trim()) {
    await db
      .update(organizations)
      .set({
        name: patch.organizationName.trim(),
        updated_at: new Date(),
      })
      .where(eq(organizations.id, organizationId));
  }

  const current = await ensureWorkspaceRow(organizationId);
  let webhookSecretOnce: string | undefined;

  const values: Partial<typeof organizationWorkspaceSettings.$inferInsert> = {
    updated_at: new Date(),
  };

  if (patch.customerFacingName !== undefined) {
    values.customer_facing_name = patch.customerFacingName;
  }
  if (patch.logoUrl !== undefined) values.logo_url = patch.logoUrl;
  if (patch.timezone !== undefined) values.timezone = patch.timezone;
  if (patch.defaultLanguage !== undefined) {
    values.default_language = patch.defaultLanguage;
  }
  if (patch.notifications) {
    values.notifications = {
      ...DEFAULT_NOTIFICATIONS,
      ...(current.notifications ?? {}),
      ...patch.notifications,
    };
  }
  if (patch.privacy) {
    values.privacy = {
      ...DEFAULT_PRIVACY,
      ...(current.privacy ?? {}),
      ...patch.privacy,
    };
  }
  if (patch.sso) {
    values.sso = {
      ...DEFAULT_SSO,
      ...(current.sso ?? {}),
      ...patch.sso,
    };
  }
  if (patch.webhookUrl !== undefined) values.webhook_url = patch.webhookUrl;

  if (patch.clearWebhookSecret) {
    values.webhook_secret_hash = null;
    values.webhook_secret_last_four = null;
  } else if (patch.rotateWebhookSecret) {
    webhookSecretOnce = `whsec_${randomBytes(24).toString("hex")}`;
    values.webhook_secret_hash = hashSecret(webhookSecretOnce);
    values.webhook_secret_last_four = webhookSecretOnce.slice(-4);
  }

  await db
    .update(organizationWorkspaceSettings)
    .set(values)
    .where(eq(organizationWorkspaceSettings.organization_id, organizationId));

  const settings = await getWorkspaceSettings(organizationId);
  return { settings, webhookSecretOnce };
}
