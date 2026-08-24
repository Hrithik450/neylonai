import type { Metadata } from "next";

/** Social preview image — served from `apps/web/public/images`. */
export const OG_IMAGE_PATH = "/images/opengraph-neylonai.png";

/** Dimensions must match the actual file, or crawlers scale the card wrongly. */
export const OG_IMAGE = {
  url: OG_IMAGE_PATH,
  width: 1731,
  height: 909,
  alt: "Neylon AI - AI-Powered Customer Engagement",
} as const;

/**
 * Next.js merges metadata *shallowly*: an `openGraph` object declared in a page
 * or nested layout REPLACES the root layout's entirely — silently dropping
 * `images`, `type`, `locale` and `siteName`, which is how a page ends up with
 * an og:title but no og:image.
 *
 * Spread this into every page-level `openGraph` override, then add that route's
 * own `title`, `description` and `url`.
 */
export const sharedOpenGraph = {
  type: "website",
  locale: "en_US",
  siteName: "Neylon AI",
  images: [OG_IMAGE],
} satisfies Metadata["openGraph"];
