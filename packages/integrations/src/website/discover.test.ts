import { describe, expect, it } from "vitest";
import { gunzipSync, gzipSync } from "node:zlib";
import { classifyUrl, rankEvergreen } from "./evergreen";
import { isDisallowedByRobots, parseRobotsTxt } from "./robots";
import { parseSitemapXml } from "./sitemap";
import { canonicalPathOf, MAX_DISCOVERED_URLS, normalizePageUrl, sameSiteHost } from "./urls";

describe("robots.txt", () => {
  it("reads Sitemap directives and * disallows", () => {
    const parsed = parseRobotsTxt(
      `User-agent: *
Disallow: /admin
Disallow: /checkout
Sitemap: https://example.com/sitemap.xml
Sitemap: /sitemap-index.xml
`,
      "https://example.com",
    );
    expect(parsed.sitemapUrls).toContain("https://example.com/sitemap.xml");
    expect(parsed.sitemapUrls).toContain(
      "https://example.com/sitemap-index.xml",
    );
    expect(isDisallowedByRobots("/admin/users", parsed.disallowPrefixes)).toBe(
      true,
    );
    expect(isDisallowedByRobots("/pricing", parsed.disallowPrefixes)).toBe(
      false,
    );
  });
});

describe("sitemap xml", () => {
  it("parses urlset loc and lastmod", () => {
    const xml = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/pricing</loc><lastmod>2026-01-02</lastmod></url>
  <url><loc>https://example.com/about</loc></url>
</urlset>`;
    const parsed = parseSitemapXml(xml, "https://example.com/sitemap.xml");
    expect(parsed.urls.map((u) => u.loc)).toEqual([
      "https://example.com/pricing",
      "https://example.com/about",
    ]);
    expect(parsed.urls[0]?.lastmod).toBe("2026-01-02");
    expect(parsed.childSitemaps).toEqual([]);
  });

  it("parses sitemap index children", () => {
    const xml = `<sitemapindex>
  <sitemap><loc>https://example.com/sitemap-pages.xml</loc></sitemap>
  <sitemap><loc>https://cdn.evil.test/other.xml</loc></sitemap>
</sitemapindex>`;
    const parsed = parseSitemapXml(xml, "https://example.com/sitemap.xml");
    expect(parsed.childSitemaps).toHaveLength(2);
    expect(parsed.urls).toEqual([]);
  });

  it("round-trips gzipped sitemap bytes", () => {
    const xml = `<urlset><url><loc>https://example.com/</loc></url></urlset>`;
    const gz = gzipSync(Buffer.from(xml));
    expect(parseSitemapXml(gz.toString("utf8"), "x").urls.length).toBe(0);
    const parsed = parseSitemapXml(
      gunzipSync(gz).toString("utf8"),
      "https://example.com/sitemap.xml.gz",
    );
    expect(parsed.urls[0]?.loc).toBe("https://example.com/");
  });

  it("tolerates malformed XML without throwing", () => {
    const parsed = parseSitemapXml("<not-a-sitemap", "https://example.com/sitemap.xml");
    expect(parsed.urls).toEqual([]);
    expect(parsed.childSitemaps).toEqual([]);
  });

  it("keeps duplicate locs (caller dedupes by canonical path)", () => {
    const xml = `<urlset>
      <url><loc>https://example.com/pricing</loc></url>
      <url><loc>https://example.com/pricing/</loc></url>
    </urlset>`;
    const parsed = parseSitemapXml(xml, "https://example.com/sitemap.xml");
    expect(parsed.urls).toHaveLength(2);
  });
});

describe("evergreen classification", () => {
  it("keeps pricing/docs and drops cart/news/facets", () => {
    const keep = [
      classifyUrl({ url: "https://ex.com/", path: "/" }),
      classifyUrl({ url: "https://ex.com/pricing", path: "/pricing" }),
      classifyUrl({ url: "https://ex.com/docs/start", path: "/docs/start" }),
      classifyUrl({ url: "https://ex.com/blog/why-we-built-x", path: "/blog/why-we-built-x" }),
    ];
    const drop = [
      classifyUrl({ url: "https://ex.com/cart", path: "/cart" }),
      classifyUrl({
        url: "https://ex.com/news/2024/03/01/launch",
        path: "/news/2024/03/01/launch",
      }),
      classifyUrl({
        url: "https://ex.com/shop?color=red&size=m&sort=price",
        path: "/shop",
      }),
    ];
    expect(keep.every((c) => !c.excluded)).toBe(true);
    expect(drop.every((c) => c.excluded)).toBe(true);
    const ranked = rankEvergreen([...keep, ...drop], 3);
    expect(ranked[0]?.category).toBe("home");
    expect(ranked.map((r) => r.path)).toContain("/pricing");
  });
});

describe("url normalize", () => {
  it("strips tracking params and trailing slash", () => {
    const url = normalizePageUrl(
      "https://www.example.com/pricing/?utm_source=x#hero",
    );
    expect(url?.pathname).toBe("/pricing");
    expect(url?.search).toBe("");
    expect(canonicalPathOf(url!)).toBe("/pricing");
    expect(sameSiteHost("www.example.com", "example.com")).toBe(true);
  });

  it("drops cross-scheme junk and keeps a discovery ceiling", () => {
    expect(normalizePageUrl("javascript:alert(1)")).toBeNull();
    expect(MAX_DISCOVERED_URLS).toBe(25_000);
  });
});
