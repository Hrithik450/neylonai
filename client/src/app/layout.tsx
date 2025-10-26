import { auth } from "@/lib/auth/auth";
import type { Metadata } from "next";
import React from "react";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { AIChat } from "@/components/support-widget/widget-toggle";
import { NuqsAdapter } from "nuqs/adapters/next/app";

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
          <Navbar session={session} />
          {children}
          <AIChat session={session} />
        </NuqsAdapter>
      </body>
    </html>
  );
}
