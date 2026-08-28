import type { Metadata } from "next";

export const OG_IMAGE_PATH = "/images/opengraph-image.jpg";

export const OG_IMAGE = {
  url: OG_IMAGE_PATH,
  width: 1200,
  height: 630,
  alt: "Neylon AI - AI-Powered Customer Engagement",
} as const;

export const sharedOpenGraph = {
  type: "website",
  locale: "en_US",
  siteName: "Neylon AI",
  images: [OG_IMAGE],
} satisfies Metadata["openGraph"];
