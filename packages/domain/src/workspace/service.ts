import { eq } from "drizzle-orm";
import {
  db,
  organizations,
  organizationSettings,
} from "@neylonai/database";
import {
  DEFAULT_PRIVACY,
  type OrganizationSettings,
  type OrganizationSettingsPatch,
} from "./types";

function mapSettings(
  org: { id: string; name: string },
  row: typeof organizationSettings.$inferSelect | null,
): OrganizationSettings {
  return {
    organizationId: org.id,
    organizationName: org.name,
    timezone: row?.timezone ?? "UTC",
    privacy: {
      ...DEFAULT_PRIVACY,
      ...(row?.privacy ?? {}),
    },
  };
}

async function ensureSettingsRow(organizationId: string) {
  const [existing] = await db
    .select()
    .from(organizationSettings)
    .where(eq(organizationSettings.organization_id, organizationId))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(organizationSettings)
    .values({ organization_id: organizationId })
    .returning();
  return created;
}

export async function getOrganizationSettings(
  organizationId: string,
): Promise<OrganizationSettings> {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!org) throw new Error("Organization not found");

  try {
    const row = await ensureSettingsRow(organizationId);
    return mapSettings(org, row);
  } catch {
    return mapSettings(org, null);
  }
}

export async function saveOrganizationSettings(
  organizationId: string,
  patch: OrganizationSettingsPatch,
): Promise<{ settings: OrganizationSettings }> {
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

  const current = await ensureSettingsRow(organizationId);

  const values: Partial<typeof organizationSettings.$inferInsert> = {
    updated_at: new Date(),
  };

  if (patch.timezone !== undefined) values.timezone = patch.timezone;
  if (patch.privacy) {
    values.privacy = {
      ...DEFAULT_PRIVACY,
      ...(current.privacy ?? {}),
      ...patch.privacy,
    };
  }

  await db
    .update(organizationSettings)
    .set(values)
    .where(eq(organizationSettings.organization_id, organizationId));

  const settings = await getOrganizationSettings(organizationId);
  return { settings };
}

