/**
 * Detect font-family names from a website (HTML + linked CSS).
 * Does not download or rehost font binaries.
 */
import { matchCatalogByFamilyName } from "@neylonai/sdk";

const GENERIC = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-sans-serif",
  "ui-serif",
  "ui-monospace",
  "ui-rounded",
  "emoji",
  "math",
  "fangsong",
  "inherit",
  "initial",
  "unset",
  "revert",
  "revert-layer",
]);

const FETCH_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 500_000;
const MAX_CSS_BYTES = 200_000;
const MAX_STYLESHEETS = 6;

export type DetectWebsiteFontsResult = {
  detected: string[];
  matchedCatalogId?: string;
  matchedFamily?: string;
  status: "matched" | "detected_unmatched" | "none";
  message: string;
};

function extractFamiliesFromCss(css: string): string[] {
  const out: string[] = [];
  const re = /font-family\s*:\s*([^;}{]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const raw = m[1] ?? "";
    for (const part of raw.split(",")) {
      const name = part.replace(/['"]/g, "").trim();
      if (!name || GENERIC.has(name.toLowerCase())) continue;
      if (/^(var\(|--)/i.test(name)) continue;
      out.push(name);
    }
  }
  return out;
}

function stylesheetHrefs(html: string, pageUrl: URL): string[] {
  const hrefs: string[] = [];
  const re =
    /<link[^>]+rel=["']?stylesheet["']?[^>]*>|<link[^>]+href=["']([^"']+)["'][^>]*rel=["']?stylesheet["']?/gi;
  const hrefRe = /href=["']([^"']+)["']/i;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && hrefs.length < MAX_STYLESHEETS) {
    const tag = m[0] ?? "";
    const href = tag.match(hrefRe)?.[1];
    if (!href) continue;
    try {
      const abs = new URL(href, pageUrl).toString();
      hrefs.push(abs);
    } catch {
      // skip
    }
  }
  return hrefs;
}

async function fetchText(
  url: string,
  maxBytes: number,
): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "NeylonAI-FontDetect/1.0",
        Accept: "text/html,text/css,*/*",
      },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.subarray(0, maxBytes).toString("utf8");
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function rankNames(names: string[]): string[] {
  const scores = new Map<string, number>();
  for (const n of names) {
    const key = n.trim();
    if (!key) continue;
    scores.set(key, (scores.get(key) ?? 0) + 1);
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name)
    .slice(0, 8);
}

export async function detectWebsiteFonts(
  rawUrl: string,
): Promise<DetectWebsiteFontsResult> {
  let pageUrl: URL;
  try {
    pageUrl = new URL(rawUrl.trim());
    if (!/^https?:$/i.test(pageUrl.protocol)) {
      throw new Error("invalid");
    }
  } catch {
    return {
      detected: [],
      status: "none",
      message: "Enter a valid http(s) website URL.",
    };
  }

  const html = await fetchText(pageUrl.toString(), MAX_HTML_BYTES);
  if (!html) {
    return {
      detected: [],
      status: "none",
      message: "Could not fetch that website. Check the URL and try again.",
    };
  }

  const collected: string[] = [];
  collected.push(...extractFamiliesFromCss(html));

  const styleBlocks = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? [];
  for (const block of styleBlocks) {
    collected.push(...extractFamiliesFromCss(block));
  }

  for (const href of stylesheetHrefs(html, pageUrl)) {
    const css = await fetchText(href, MAX_CSS_BYTES);
    if (css) collected.push(...extractFamiliesFromCss(css));
  }

  const detected = rankNames(collected);
  if (detected.length === 0) {
    return {
      detected: [],
      status: "none",
      message: "No custom font-family declarations found on that page.",
    };
  }

  for (const name of detected) {
    const match = matchCatalogByFamilyName(name);
    if (match) {
      return {
        detected,
        matchedCatalogId: match.id,
        matchedFamily: match.family,
        status: "matched",
        message: `Matched catalog font “${match.label}” from your site.`,
      };
    }
  }

  const top = detected[0]!;
  return {
    detected,
    status: "detected_unmatched",
    message: `We found “${top}” on your website but couldn’t load it automatically (licensing/CORS). Please upload the font file.`,
  };
}
