export type EvergreenCategory =
  | "home"
  | "product"
  | "features"
  | "pricing"
  | "about"
  | "team"
  | "contact"
  | "faq"
  | "help"
  | "docs"
  | "blog"
  | "case_study"
  | "policy"
  | "careers"
  | "other";

export type ClassifiedUrl = {
  url: string;
  path: string;
  lastmod: string | null;
  sitemapGroup: string | null;
  category: EvergreenCategory;
  score: number;
  excluded: boolean;
  excludeReason: string | null;
};

const EXCLUDE_PATH =
  /\/(cart|checkout|basket|account|login|signin|signup|register|search|wp-admin|wp-login|cgi-bin|tag|tags|topics?|author|authors|page\/\d|paged\/\d|feed|rss|amp)(\/|$)/i;

const CATALOG_PATH =
  /\/(products?|items?|sku|collections?|catalog|category|categories|shop|listing|inventory|variants?|dp)(\/|$)/i;

const DATED_NEWS = /\/(20\d{2})\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])(\/|$)/;
const ARCHIVE_YEAR = /\/(news|press|archive)\/20\d{2}(\/|$)/i;
const PAGINATION = /[?&](page|paged|offset|p)=\d+/i;
const FACET = /[?&](sort|filter|color|size|refinements?|facet)=/i;
const SKU_QUERY = /[?&](sku|product_id|item_id|variant|gclid)=/i;

const CATEGORY_RULES: Array<{ category: EvergreenCategory; re: RegExp; score: number }> =
  [
    { category: "pricing", re: /\/(pricing|plans?|packages?)(\/|$)/i, score: 100 },
    { category: "faq", re: /\/(faq|faqs|questions)(\/|$)/i, score: 96 },
    { category: "docs", re: /\/(docs?|documentation|developer|api|guide|guides|handbook)(\/|$)/i, score: 94 },
    { category: "help", re: /\/(help|support|knowledge-base|kb|how-to)(\/|$)/i, score: 92 },
    { category: "features", re: /\/(features?|product|platform|solutions?|capabilities)(\/|$)/i, score: 90 },
    { category: "about", re: /\/(about|company|mission|story|who-we-are)(\/|$)/i, score: 88 },
    { category: "contact", re: /\/(contact|contacts|get-in-touch)(\/|$)/i, score: 86 },
    { category: "policy", re: /\/(privacy|terms|legal|cookies?|gdpr|security|trust)(\/|$)/i, score: 84 },
    { category: "case_study", re: /\/(case-stud(?:y|ies)|customers?|stories|testimonials)(\/|$)/i, score: 80 },
    { category: "blog", re: /\/(blog|resources?|learn|articles?|insights?)(\/|$)/i, score: 74 },
    { category: "team", re: /\/(team|people|leadership)(\/|$)/i, score: 72 },
    { category: "careers", re: /\/(careers?|jobs?|hiring)(\/|$)/i, score: 60 },
    { category: "product", re: /\/(integrations?|use-cases?|industries)(\/|$)/i, score: 82 },
  ];

export function classifyUrl(input: {
  url: string;
  path: string;
  lastmod?: string | null;
  sitemapGroup?: string | null;
}): ClassifiedUrl {
  const path = input.path || "/";
  const search = (() => {
    try {
      return new URL(input.url).search;
    } catch {
      return "";
    }
  })();
  const group = input.sitemapGroup ?? "";

  if (EXCLUDE_PATH.test(path)) {
    return excluded(input, "utility_or_account");
  }
  if (CATALOG_PATH.test(path) && /\/[a-z0-9-]{8,}$/i.test(path)) {
    return excluded(input, "catalog_detail");
  }
  if (DATED_NEWS.test(path) || ARCHIVE_YEAR.test(path)) {
    return excluded(input, "dated_news");
  }
  if (PAGINATION.test(search) || FACET.test(search) || SKU_QUERY.test(search)) {
    return excluded(input, "faceted_or_paginated");
  }
  if ((search.match(/=/g) ?? []).length >= 3) {
    return excluded(input, "query_variant");
  }
  if (/\/[0-9]{5,}(\/|$)/.test(path)) {
    return excluded(input, "sku_like");
  }

  if (path === "/" || path === "") {
    return {
      url: input.url,
      path,
      lastmod: input.lastmod ?? null,
      sitemapGroup: input.sitemapGroup ?? null,
      category: "home",
      score: 110,
      excluded: false,
      excludeReason: null,
    };
  }

  for (const rule of CATEGORY_RULES) {
    if (rule.re.test(path) || (group && rule.re.test(group))) {
      return {
        url: input.url,
        path,
        lastmod: input.lastmod ?? null,
        sitemapGroup: input.sitemapGroup ?? null,
        category: rule.category,
        score: rule.score,
        excluded: false,
        excludeReason: null,
      };
    }
  }

  return {
    url: input.url,
    path,
    lastmod: input.lastmod ?? null,
    sitemapGroup: input.sitemapGroup ?? null,
    category: "other",
    score: 20,
    excluded: false,
    excludeReason: null,
  };
}

function excluded(
  input: {
    url: string;
    path: string;
    lastmod?: string | null;
    sitemapGroup?: string | null;
  },
  reason: string,
): ClassifiedUrl {
  return {
    url: input.url,
    path: input.path,
    lastmod: input.lastmod ?? null,
    sitemapGroup: input.sitemapGroup ?? null,
    category: "other",
    score: 0,
    excluded: true,
    excludeReason: reason,
  };
}

export function rankEvergreen(
  items: ClassifiedUrl[],
  maxPages: number,
): ClassifiedUrl[] {
  return items
    .filter((item) => !item.excluded && item.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, Math.max(1, maxPages));
}

export function categorySummary(
  items: ClassifiedUrl[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    if (item.excluded) continue;
    out[item.category] = (out[item.category] ?? 0) + 1;
  }
  return out;
}
