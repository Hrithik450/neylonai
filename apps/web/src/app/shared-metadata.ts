import type { Metadata } from "next";

export const OG_IMAGE_PATH = "/images/opengraph-neylonai.png";

export const OG_IMAGE = {
  url: OG_IMAGE_PATH,
  width: 1731,
  height: 909,
  alt: "Neylon AI - AI-Powered Customer Engagement",
} as const;

export const sharedOpenGraph = {
  type: "website",
  locale: "en_US",
  siteName: "Neylon AI",
  images: [OG_IMAGE],
} satisfies Metadata["openGraph"];
