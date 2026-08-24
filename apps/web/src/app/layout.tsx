import "./globals.css";

import type { Metadata } from "next";
import React from "react";
import { appFontClassName } from "@/assets/fonts";
import { OG_IMAGE_PATH, sharedOpenGraph } from "./shared-metadata";

// Avoid Next 15 App Router static prerender of /_not-found (React dispatcher null).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://neylonai.mhrithik.com"),
  title: {
    default: "Neylon AI - AI-Powered Customer Engagement & Real-Time Visitor Insights",
    template: "%s | Neylon AI",
  },
  description:
    "Transform website visitors into engaged customers with Neylon AI. Real-time visitor tracking, proactive engagement, and AI-powered conversations that convert. Start free today.",
  keywords: [
    "AI customer engagement",
    "visitor tracking",
    "proactive chat",
    "AI chatbot",
    "customer engagement platform",
    "real-time analytics",
    "website visitor tracking",
    "AI automation",
    "conversational AI",
    "lead generation",
    "customer support automation",
    "intelligent agents",
  ],
  authors: [{ name: "Neylon AI" }],
  creator: "Neylon AI",
  publisher: "Neylon AI",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    ...sharedOpenGraph,
    url: "/",
    title: "Neylon AI - AI-Powered Customer Engagement Platform",
    description:
      "Know why visitors leave. Engage them sooner. Real-time visitor insights and proactive AI conversations that turn traffic into engagement.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Neylon AI - AI-Powered Customer Engagement Platform",
    description:
      "Know why visitors leave. Engage them sooner. Real-time visitor insights and proactive AI conversations.",
    images: [OG_IMAGE_PATH],
    creator: "@neylonai",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/images/favicon.jpg",
    shortcut: "/images/favicon.jpg",
    apple: "/images/neylonai-logo.jpg",
  },
  alternates: {
    canonical: "/",
  },
  verification: {
    google: "your-google-verification-code",
    // yandex: "your-yandex-verification-code",
    // bing: "your-bing-verification-code",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
      </head>
      <body className={appFontClassName} cz-shortcut-listen="false">
        {children}
      </body>
    </html>
  );
}
