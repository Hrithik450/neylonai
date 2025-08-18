import "./globals.css";

import type { Metadata } from "next";
import React, { Suspense } from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Navbar } from "@/components/navigation/navbar";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AIChat } from "@/components/widget/widget-toggle";

import { LayoutWrapper } from "./layout-wrapper";

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
  return (
    <html lang="en">
      <body cz-shortcut-listen="false">
        <GoogleOAuthProvider
          clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}
        >
          <NuqsAdapter>
            <LayoutWrapper>
              <Suspense fallback={null}>
                <Navbar />
                {children}
                <AIChat />
              </Suspense>
            </LayoutWrapper>
          </NuqsAdapter>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
