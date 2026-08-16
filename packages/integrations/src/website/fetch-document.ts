import { gunzipSync } from "node:zlib";
import { assertSafePublicHttpUrl } from "./urls";

const FETCH_TIMEOUT_MS = 20_000;
const MAX_BYTES = 50 * 1024 * 1024;

export async function fetchPublicDocument(
  urlInput: string,
  accept: string,
): Promise<{ url: string; finalUrl: string; body: Buffer; contentType: string }> {
  const parsed = assertSafePublicHttpUrl(urlInput);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(parsed.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: accept,
        "User-Agent": "NeylonAI-Crawler/1.0 (+https://neylon.ai)",
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch ${parsed.pathname} (${res.status}).`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) {
      throw new Error("Document exceeds the 50 MB sitemap size limit.");
    }
    const encoding = (res.headers.get("content-encoding") ?? "").toLowerCase();
    const finalUrl = res.url || parsed.toString();
    const gzipped =
      encoding.includes("gzip") ||
      parsed.pathname.endsWith(".gz") ||
      finalUrl.toLowerCase().endsWith(".gz");
    const body = gzipped ? gunzipSync(buf) : buf;
    if (body.byteLength > MAX_BYTES) {
      throw new Error("Uncompressed document exceeds the 50 MB limit.");
    }
    return {
      url: parsed.toString(),
      finalUrl,
      body,
      contentType: (res.headers.get("content-type") ?? "").toLowerCase(),
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Timed out fetching sitemap or robots.txt.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchPublicText(
  urlInput: string,
  accept: string,
): Promise<{ url: string; finalUrl: string; text: string }> {
  const doc = await fetchPublicDocument(urlInput, accept);
  return {
    url: doc.url,
    finalUrl: doc.finalUrl,
    text: doc.body.toString("utf8"),
  };
}
