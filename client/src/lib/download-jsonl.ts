import { createWriteStream, existsSync } from "fs";
import { mkdir } from "fs/promises";
import path from "path";
import { pipeline } from "stream";
import { promisify } from "util";

const streamPipeline = promisify(pipeline);

const DATA_DIR = path.join(process.cwd(), "lib/data");
const FILE_PATH = path.join(DATA_DIR, "data.jsonl");
const GCS_URL =
  "https://storage.googleapis.com/2g_mails_jsonl_data/clean_mails.jsonl";

export async function ensureJsonlFile(): Promise<string> {
  if (existsSync(FILE_PATH)) return FILE_PATH;
  await mkdir(DATA_DIR, { recursive: true });
  console.log("Downloading data jsonl file from GCS...");

  const response = await fetch(GCS_URL);
  if (!response.ok)
    throw new Error(`Failed to download file: ${response.statusText}`);

  await streamPipeline(response.body as any, createWriteStream(FILE_PATH));
  console.log("Download complete:", FILE_PATH);
  return FILE_PATH;
}
