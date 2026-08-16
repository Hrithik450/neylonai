export type SitemapUrl = {
  loc: string;
  lastmod: string | null;
  sitemapGroup: string | null;
};

export type ParsedSitemap = {
  urls: SitemapUrl[];
  childSitemaps: string[];
};

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

function tagContents(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gi");
  const out: string[] = [];
  for (const match of xml.matchAll(re)) {
    out.push(decodeXml(match[1] ?? ""));
  }
  return out;
}

export function parseSitemapXml(
  xml: string,
  sitemapUrl: string,
): ParsedSitemap {
  const trimmed = xml.replace(/^\uFEFF/, "").trim();
  const urls: SitemapUrl[] = [];
  const childSitemaps: string[] = [];

  if (/<sitemapindex[\s>]/i.test(trimmed)) {
    for (const loc of tagContents(trimmed, "loc")) {
      if (loc.startsWith("http")) childSitemaps.push(loc);
    }
    return { urls, childSitemaps };
  }

  const blocks = trimmed.split(/<\/url>/i);
  for (const block of blocks) {
    const loc = tagContents(block, "loc")[0];
    if (!loc?.startsWith("http")) continue;
    const lastmod = tagContents(block, "lastmod")[0] || null;
    urls.push({
      loc,
      lastmod,
      sitemapGroup: sitemapUrl,
    });
  }

  if (urls.length === 0) {
    for (const loc of tagContents(trimmed, "loc")) {
      if (!loc.startsWith("http")) continue;
      urls.push({ loc, lastmod: null, sitemapGroup: sitemapUrl });
    }
  }

  return { urls, childSitemaps };
}

export const STANDARD_SITEMAP_PATHS = [
  "/sitemap.xml",
  "/sitemap_index.xml",
  "/sitemap-index.xml",
  "/sitemap.xml.gz",
];
