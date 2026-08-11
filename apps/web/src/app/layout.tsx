import "./globals.css";

import type { Metadata } from "next";
import React from "react";

// Avoid Next 15 App Router static prerender of /_not-found (React dispatcher null).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Neylon AI",
  description:
    "Neylon AI is a full-service AI agency specializing in the development of custom AI solutions, intelligent agents, and automation systems for both enterprises and individual consumers.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body cz-shortcut-listen="false">{children}</body>
    </html>
  );
}
