/**
 * Knowledge source file storage (PDF uploads).
 * Same dual backend as org logos: local disk or Vercel Blob.
 */
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";

export const MAX_KNOWLEDGE_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

export type PutKnowledgeFileResult = {
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

export function assertKnowledgeFileStorageConfigured(): void {
  if (isServerlessRuntime() && !blobToken()) {
    throw new Error(
      "Knowledge file uploads on Vercel require BLOB_READ_WRITE_TOKEN.",
    );
  }
}

function rootDir(): string {
  const fromEnv = process.env.NEYLONAI_KNOWLEDGE_FILES_DIR?.trim();
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), "data", "knowledge-files");
}

async function ensureParent(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
}

export async function putKnowledgeFileObject(input: {
  key: string;
  bytes: Buffer;
  contentType: string;
}): Promise<PutKnowledgeFileResult> {
  assertKnowledgeFileStorageConfigured();

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

export async function getKnowledgeFileObject(
  key: string,
): Promise<{ key: string; bytes: Buffer } | null> {
  const token = blobToken();
  if (token) {
    // Blob files are fetched via publicUrl when present; disk fallback for local keys.
    try {
      const filePath = path.join(rootDir(), key);
      const bytes = await readFile(filePath);
      return { key, bytes };
    } catch {
      return null;
    }
  }

  try {
    const filePath = path.join(rootDir(), key);
    const bytes = await readFile(filePath);
    return { key, bytes };
  } catch {
    return null;
  }
}

export async function deleteKnowledgeFileObject(key: string): Promise<void> {
  const token = blobToken();
  if (token) {
    try {
      await del(key, { token });
    } catch {
      // ignore missing
    }
  }
  try {
    await unlink(path.join(rootDir(), key));
  } catch {
    // ignore missing
  }
}

export function knowledgeFileStorageKey(
  organizationId: string,
  sourceId: string,
  fileName: string,
): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
  return `knowledge/${organizationId}/${sourceId}/${safe || "file"}`;
}
