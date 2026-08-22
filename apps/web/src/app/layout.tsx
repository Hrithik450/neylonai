import "./globals.css";

import type { Metadata } from "next";
import React from "react";
import { appFontClassName } from "@/assets/fonts";

// Avoid Next 15 App Router static prerender of /_not-found (React dispatcher null).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://neylon.ai"),
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
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Neylon AI",
    title: "Neylon AI - AI-Powered Customer Engagement Platform",
    description:
      "Know why visitors leave. Engage them sooner. Real-time visitor insights and proactive AI conversations that turn traffic into engagement.",
    images: [
      {
        url: "/images/opengraph-neylonai.png",
        width: 1200,
        height: 630,
        alt: "Neylon AI - AI-Powered Customer Engagement",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Neylon AI - AI-Powered Customer Engagement Platform",
    description:
      "Know why visitors leave. Engage them sooner. Real-time visitor insights and proactive AI conversations.",
    images: ["/images/opengraph-neylonai.png"],
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
