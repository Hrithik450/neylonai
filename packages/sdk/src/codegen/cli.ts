#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  renderSectionTypesModule,
  type PageSectionKeyManifest,
} from "./render-section-types.js";

type CliArgs = {
  apiKey: string;
  origin: string;
  out: string;
};

function printUsage(): never {
  console.error(`Usage:
  pnpm --filter @neylonai/sdk generate-sections -- \\
    --api-key nk_live_… \\
    --out ./src/neylon-sections.ts \\
    [--origin https://api.neylon.ai]

Environment:
  NEXT_PUBLIC_NEYLONAI_API_KEY
  NEYLONAI_API_ORIGIN / NEXT_PUBLIC_NEYLONAI_API_ORIGIN
`);
  process.exit(1);
}

function parseArgs(argv: string[]): CliArgs {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (token === "--") continue;
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      console.error(`Missing value for --${key}`);
      printUsage();
    }
    args[key] = value;
    i += 1;
  }

  const apiKey =
    args["api-key"]?.trim() ||
    process.env.NEXT_PUBLIC_NEYLONAI_API_KEY?.trim() ||
    "";

  // Security: only accept NEXT_PUBLIC_NEYLONAI_API_KEY to prevent accidental
  // exposure of private keys in client bundles
  if (!apiKey && process.env.NEYLONAI_API_KEY) {
    console.error(
      "ERROR: NEYLONAI_API_KEY is not supported in SDK CLI.\n" +
      "Use NEXT_PUBLIC_NEYLONAI_API_KEY instead to make it explicit that this key will be public.\n"
    );
    process.exit(1);
  }

  const origin = (
    args.origin?.trim() ||
    process.env.NEXT_PUBLIC_NEYLONAI_API_ORIGIN?.trim() ||
    "https://api.neylon.ai"
  ).replace(/\/$/, "");
  const out = args.out?.trim();
  if (!apiKey || !out) printUsage();

  return { apiKey, origin, out: resolve(out) };
}

async function fetchManifest(
  origin: string,
  apiKey: string,
): Promise<PageSectionKeyManifest> {
  const response = await fetch(`${origin}/api/v1/page-sections`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  const json = (await response.json().catch(() => null)) as {
    success?: boolean;
    data?: { pages?: PageSectionKeyManifest };
    error?: string;
  } | null;

  if (!response.ok || !json?.success || !json.data?.pages) {
    throw new Error(
      json?.error ||
        `Failed to fetch page sections (${response.status} ${response.statusText})`,
    );
  }
  return json.data.pages;
}

async function main(): Promise<void> {
  const { apiKey, origin, out } = parseArgs(process.argv.slice(2));
  const pages = await fetchManifest(origin, apiKey);
  const source = renderSectionTypesModule(pages);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, source, "utf8");
  const pathCount = Object.keys(pages).length;
  const keyCount = Object.values(pages).reduce(
    (sum, keys) => sum + keys.length,
    0,
  );
  console.log(
    `Wrote ${out} (${pathCount} page${pathCount === 1 ? "" : "s"}, ${keyCount} section key${keyCount === 1 ? "" : "s"})`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
