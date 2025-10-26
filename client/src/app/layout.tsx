import "./globals.css";
import React from "react";
import type { Metadata } from "next";
import { auth } from "@/lib/auth/auth";
import { Navbar } from "@/components/navbar";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { LayoutWrapper } from "@/app/layout-wrapper";
import { AIChat } from "@/components/support-widget/widget-toggle";

export const metadata: Metadata = {
  title: "Neylon AI",
  description:
    "Neylon-AI is a full-service AI agency specializing in the development of custom AI solutions, intelligent agents, and automation systems for both enterprises and individual consumers.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = React.use(auth());

  return (
    <html lang="en">
      <body cz-shortcut-listen="false">
        <NuqsAdapter>
          <LayoutWrapper session={session}>
            <Navbar />
            {children}
            <AIChat />
          </LayoutWrapper>
        </NuqsAdapter>
      </body>
    </html>
  );
}
