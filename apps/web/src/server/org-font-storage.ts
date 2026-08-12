/**
 * Org font binary storage.
 *
 * - Local / Docker: filesystem under data/org-fonts (or NEYLONAI_ORG_FONTS_DIR)
 * - Vercel / serverless: Vercel Blob (requires BLOB_READ_WRITE_TOKEN)
 *
 * Ephemeral serverless disks are never used for durable font storage.
 */
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";

export type StoredFontObject = {
  key: string;
  bytes: Buffer;
  contentType: string;
};

export type PutOrgFontResult = {
  key: string;
  /** Absolute CDN URL when using Vercel Blob; null for local disk. */
  publicUrl: string | null;
};

function blobToken(): string | null {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || null;
}

function isServerlessRuntime(): boolean {
  return (
    process.env.VERCEL === "1" ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    process.env.NEXT_RUNTIME === "edge"
  );
}

/** Prefer Blob whenever a token is configured; require it on Vercel. */
export function shouldUseBlobStorage(): boolean {
  return Boolean(blobToken());
}

export function assertFontStorageConfigured(): void {
  if (isServerlessRuntime() && !blobToken()) {
    throw new Error(
      "Font uploads on Vercel require BLOB_READ_WRITE_TOKEN (Vercel Blob). Add it in project env, then redeploy.",
    );
  }
}

function rootDir(): string {
  const fromEnv = process.env.NEYLONAI_ORG_FONTS_DIR?.trim();
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), "data", "org-fonts");
}

async function ensureParent(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
}

export async function putOrgFontObject(input: {
  key: string;
  bytes: Buffer;
  contentType: string;
}): Promise<PutOrgFontResult> {
  assertFontStorageConfigured();

  const token = blobToken();
  if (token) {
    const result = await put(input.key, input.bytes, {
      access: "public",
      contentType: input.contentType,
      token,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return { key: input.key, publicUrl: result.url };
  }

  const filePath = path.join(rootDir(), input.key);
  await ensureParent(filePath);
  await writeFile(filePath, input.bytes);
  return { key: input.key, publicUrl: null };
}

export async function getOrgFontObject(
  key: string,
): Promise<StoredFontObject | null> {
  // Disk path (local / docker). Blob-backed fonts are served via publicUrl redirect.
  try {
    const filePath = path.join(rootDir(), key);
    const bytes = await readFile(filePath);
    return { key, bytes, contentType: "application/octet-stream" };
  } catch {
    return null;
  }
}

export async function deleteOrgFontObject(input: {
  key: string;
  publicUrl?: string | null;
}): Promise<void> {
  const token = blobToken();
  if (token && input.publicUrl) {
    try {
      await del(input.publicUrl, { token });
    } catch (error) {
      console.warn(
        "[org-fonts] Blob delete failed:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  try {
    await unlink(path.join(rootDir(), input.key));
  } catch {
    // ignore missing local file
  }
}

export function buildOrgFontStorageKey(input: {
  organizationId: string;
  fontId: string;
  ext: string;
}): string {
  const safeExt = input.ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "woff2";
  return `orgs/${input.organizationId}/fonts/${input.fontId}.${safeExt}`;
}
