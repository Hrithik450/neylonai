import { eq } from "drizzle-orm";
import { db, organizationLogos, widgetConfigs } from "@neylonai/database";
import { randomUUID } from "node:crypto";
import {
  buildOrgLogoStorageKey,
  deleteOrgLogoObject,
  getOrgLogoObject,
  putOrgLogoObject,
} from "./org-logo-storage";
import {
  mergeWidgetConfig,
  type StoredWidgetConfig,
} from "@/lib/widget-config-types";

/** Product limit: one brand logo per organization. */
export const ORG_LOGO_MAX_COUNT = 1;
export const ORG_LOGO_MAX_BYTES = 1 * 1024 * 1024;

const ALLOWED_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
};

export type OrgLogoRecord = {
  id: string;
  organizationId: string;
  originalFilename: string;
  contentType: string;
  byteSize: number;
  storageKey: string;
  createdAt: string;
  /** Same-origin API route that streams the logo bytes. */
  fileUrl: string;
};

function extFromFilename(name: string): string | null {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m?.[1] ?? null;
}

function toRecord(row: typeof organizationLogos.$inferSelect): OrgLogoRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    originalFilename: row.original_filename,
    contentType: row.content_type,
    byteSize: row.byte_size,
    storageKey: row.storage_key,
    createdAt: row.created_at?.toISOString() ?? new Date().toISOString(),
    fileUrl: `/api/v1/org-logos/${row.id}/file`,
  };
}

async function patchWidgetLogoUrl(
  organizationId: string,
  logoUrl: string | null,
): Promise<void> {
  const [cfgRow] = await db
    .select()
    .from(widgetConfigs)
    .where(eq(widgetConfigs.organization_id, organizationId))
    .limit(1);
  if (!cfgRow) return;

  const raw = (cfgRow.config ?? {}) as StoredWidgetConfig;
  const next = mergeWidgetConfig({
    ...raw,
    branding: {
      ...raw.branding,
      // Empty string clears default Neylon logo from merge defaults.
      logoUrl: logoUrl ?? "",
    },
  });

  await db
    .update(widgetConfigs)
    .set({ config: next, updated_at: new Date() })
    .where(eq(widgetConfigs.id, cfgRow.id));
}

export async function getOrgLogo(
  organizationId: string,
): Promise<OrgLogoRecord | null> {
  const [row] = await db
    .select()
    .from(organizationLogos)
    .where(eq(organizationLogos.organization_id, organizationId))
    .limit(1);
  return row ? toRecord(row) : null;
}

export async function uploadOrgLogo(input: {
  organizationId: string;
  filename: string;
  bytes: Buffer;
}): Promise<
  | { success: true; data: OrgLogoRecord }
  | { success: false; error: string; status: number }
> {
  const ext = extFromFilename(input.filename);
  if (!ext || !ALLOWED_EXT[ext]) {
    return {
      success: false,
      error: "Unsupported image type. Use PNG, JPG, WEBP, GIF, or SVG.",
      status: 400,
    };
  }
  if (input.bytes.byteLength <= 0 || input.bytes.byteLength > ORG_LOGO_MAX_BYTES) {
    return {
      success: false,
      error: `Logo must be between 1 byte and ${ORG_LOGO_MAX_BYTES / (1024 * 1024)}MB.`,
      status: 400,
    };
  }

  const existing = await getOrgLogo(input.organizationId);
  if (existing) {
    await deleteOrgLogoObject({ key: existing.storageKey });
    await db
      .delete(organizationLogos)
      .where(eq(organizationLogos.id, existing.id));
  }

  const logoId = randomUUID();
  const contentType = ALLOWED_EXT[ext]!;
  const storageKey = buildOrgLogoStorageKey({
    organizationId: input.organizationId,
    logoId,
    ext,
  });

  try {
    await putOrgLogoObject({
      key: storageKey,
      bytes: input.bytes,
      contentType,
    });
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to store logo file",
      status: 500,
    };
  }

  const [row] = await db
    .insert(organizationLogos)
    .values({
      id: logoId,
      organization_id: input.organizationId,
      original_filename: input.filename.slice(0, 255),
      content_type: contentType,
      byte_size: input.bytes.byteLength,
      storage_key: storageKey,
    })
    .returning();

  const record = toRecord(row!);
  await patchWidgetLogoUrl(input.organizationId, record.fileUrl);
  return { success: true, data: record };
}

export async function deleteOrgLogo(input: {
  organizationId: string;
}): Promise<{ success: boolean; error?: string }> {
  const existing = await getOrgLogo(input.organizationId);
  if (!existing) return { success: false, error: "Logo not found" };

  await deleteOrgLogoObject({ key: existing.storageKey });
  await db
    .delete(organizationLogos)
    .where(eq(organizationLogos.id, existing.id));
  await patchWidgetLogoUrl(input.organizationId, null);
  return { success: true };
}

export async function resolveOrgLogoFile(
  logoId: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const [row] = await db
    .select()
    .from(organizationLogos)
    .where(eq(organizationLogos.id, logoId))
    .limit(1);
  if (!row) return null;

  const obj = await getOrgLogoObject(row.storage_key);
  if (!obj) return null;
  return {
    bytes: obj.bytes,
    contentType: row.content_type || obj.contentType,
  };
}
