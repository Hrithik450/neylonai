/**
 * Org logo binary storage (max 1 per org at the service layer).
 *
 * - Local / Docker: filesystem under data/org-logos (or NEYLONAI_ORG_LOGOS_DIR)
 * - Vercel / serverless: Vercel Blob (requires BLOB_READ_WRITE_TOKEN)
 */
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";

export type PutOrgLogoResult = {
  key: string;
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

export function assertLogoStorageConfigured(): void {
  if (isServerlessRuntime() && !blobToken()) {
    throw new Error(
      "Logo uploads on Vercel require BLOB_READ_WRITE_TOKEN (Vercel Blob). Add it in project env, then redeploy.",
    );
  }
}

function rootDir(): string {
  const fromEnv = process.env.NEYLONAI_ORG_LOGOS_DIR?.trim();
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), "data", "org-logos");
}

async function ensureParent(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
}

export async function putOrgLogoObject(input: {
  key: string;
  bytes: Buffer;
  contentType: string;
}): Promise<PutOrgLogoResult> {
  assertLogoStorageConfigured();

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

export async function getOrgLogoObject(
  key: string,
): Promise<{ key: string; bytes: Buffer; contentType: string } | null> {
  try {
    const filePath = path.join(rootDir(), key);
    const bytes = await readFile(filePath);
    return { key, bytes, contentType: "application/octet-stream" };
  } catch {
    return null;
  }
}

export async function deleteOrgLogoObject(input: {
  key: string;
  publicUrl?: string | null;
}): Promise<void> {
  const token = blobToken();
  if (token && input.publicUrl) {
    try {
      await del(input.publicUrl, { token });
    } catch (error) {
      console.warn(
        "[org-logos] Blob delete failed:",
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

export function buildOrgLogoStorageKey(input: {
  organizationId: string;
  logoId: string;
  ext: string;
}): string {
  const safeExt = input.ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "png";
  return `orgs/${input.organizationId}/logo/${input.logoId}.${safeExt}`;
}
