import { and, count, desc, eq } from "drizzle-orm";
import { db, organizationFonts, widgetConfigs } from "@neylonai/database";
import { randomUUID } from "node:crypto";
import {
  buildOrgFontStorageKey,
  deleteOrgFontObject,
  getOrgFontObject,
  putOrgFontObject,
} from "./org-font-storage";
import {
  DEFAULT_WIDGET_FONT,
  mergeWidgetConfig,
  type StoredWidgetConfig,
} from "@/lib/widget-config-types";

export const ORG_FONT_MAX_COUNT = 10;
export const ORG_FONT_MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED_EXT: Record<string, string> = {
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf",
};

export type OrgFontRecord = {
  id: string;
  organizationId: string;
  familyName: string;
  originalFilename: string;
  contentType: string;
  byteSize: number;
  storageKey: string;
  createdAt: string;
  /** Same-origin API route that streams the font bytes. */
  fileUrl: string;
};

function extFromFilename(name: string): string | null {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m?.[1] ?? null;
}

function familyFromFilename(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return base.slice(0, 80) || "Custom Font";
}

function toRecord(row: typeof organizationFonts.$inferSelect): OrgFontRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    familyName: row.family_name,
    originalFilename: row.original_filename,
    contentType: row.content_type,
    byteSize: row.byte_size,
    storageKey: row.storage_key,
    createdAt: row.created_at?.toISOString() ?? new Date().toISOString(),
    fileUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "https://neylonai.mhrithik.com"}/api/v1/org-fonts/${row.id}/file`,
  };
}

export async function listOrgFonts(
  organizationId: string,
): Promise<OrgFontRecord[]> {
  const rows = await db
    .select()
    .from(organizationFonts)
    .where(eq(organizationFonts.organization_id, organizationId))
    .orderBy(desc(organizationFonts.created_at));
  return rows.map(toRecord);
}

export async function countOrgFonts(organizationId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(organizationFonts)
    .where(eq(organizationFonts.organization_id, organizationId));
  return Number(row?.n ?? 0);
}

export async function getOrgFontById(
  fontId: string,
): Promise<OrgFontRecord | null> {
  const [row] = await db
    .select()
    .from(organizationFonts)
    .where(eq(organizationFonts.id, fontId))
    .limit(1);
  return row ? toRecord(row) : null;
}

export async function uploadOrgFont(input: {
  organizationId: string;
  filename: string;
  bytes: Buffer;
  familyName?: string;
}): Promise<
  | { success: true; data: OrgFontRecord }
  | { success: false; error: string; status: number }
> {
  const ext = extFromFilename(input.filename);
  if (!ext || !ALLOWED_EXT[ext]) {
    return {
      success: false,
      error: "Unsupported font type. Use .woff2, .woff, .ttf, or .otf.",
      status: 400,
    };
  }
  if (input.bytes.byteLength <= 0 || input.bytes.byteLength > ORG_FONT_MAX_BYTES) {
    return {
      success: false,
      error: `Font must be between 1 byte and ${ORG_FONT_MAX_BYTES / (1024 * 1024)}MB.`,
      status: 400,
    };
  }

  const existing = await countOrgFonts(input.organizationId);
  if (existing >= ORG_FONT_MAX_COUNT) {
    return {
      success: false,
      error: `Font limit reached (${ORG_FONT_MAX_COUNT}). Delete an existing font to upload another.`,
      status: 409,
    };
  }

  const fontId = randomUUID();
  const contentType = ALLOWED_EXT[ext]!;
  const storageKey = buildOrgFontStorageKey({
    organizationId: input.organizationId,
    fontId,
    ext,
  });
  const familyName = (
    input.familyName?.trim() || familyFromFilename(input.filename)
  ).slice(0, 120);

  try {
    await putOrgFontObject({
      key: storageKey,
      bytes: input.bytes,
      contentType,
    });
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to store font file",
      status: 500,
    };
  }

  const [row] = await db
    .insert(organizationFonts)
    .values({
      id: fontId,
      organization_id: input.organizationId,
      family_name: familyName,
      original_filename: input.filename.slice(0, 255),
      content_type: contentType,
      byte_size: input.bytes.byteLength,
      storage_key: storageKey,
    })
    .returning();

  return { success: true, data: toRecord(row!) };
}

export async function deleteOrgFont(input: {
  organizationId: string;
  fontId: string;
}): Promise<{ success: boolean; error?: string }> {
  const [row] = await db
    .select()
    .from(organizationFonts)
    .where(
      and(
        eq(organizationFonts.id, input.fontId),
        eq(organizationFonts.organization_id, input.organizationId),
      ),
    )
    .limit(1);

  if (!row) return { success: false, error: "Font not found" };

  await deleteOrgFontObject({ key: row.storage_key });
  await db
    .delete(organizationFonts)
    .where(eq(organizationFonts.id, input.fontId));

  const [cfgRow] = await db
    .select()
    .from(widgetConfigs)
    .where(eq(widgetConfigs.organization_id, input.organizationId))
    .limit(1);

  if (cfgRow?.config) {
    const raw = cfgRow.config as StoredWidgetConfig;
    if (raw.branding?.font?.customFontId === input.fontId) {
      const next = mergeWidgetConfig({
        ...raw,
        branding: {
          ...raw.branding,
          font: { ...DEFAULT_WIDGET_FONT },
        },
      });
      await db
        .update(widgetConfigs)
        .set({ config: next, updated_at: new Date() })
        .where(eq(widgetConfigs.id, cfgRow.id));
    }
  }

  return { success: true };
}

export async function resolveOrgFontFile(
  fontId: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const [row] = await db
    .select()
    .from(organizationFonts)
    .where(eq(organizationFonts.id, fontId))
    .limit(1);
  if (!row) return null;

  const obj = await getOrgFontObject(row.storage_key);
  if (!obj) return null;
  return {
    bytes: obj.bytes,
    contentType: row.content_type || obj.contentType,
  };
}
