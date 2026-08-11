import React, { Suspense } from "react";
import { Navbar } from "@/components/navigation/navbar";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { SupportWidgetHost } from "@/components/support-widget-host";
import { getSiteWidgetApiKey } from "@/server/site-widget";

import { LayoutWrapper } from "../layout-wrapper";

export default async function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const googleClientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    "";
  // Same as a customer embed: publishable key for this deployment’s org.
  const siteApiKey = getSiteWidgetApiKey();

  const body = (
    <LayoutWrapper>
      <Suspense fallback={null}>
        <Navbar />
        {children}
        <SupportWidgetHost apiKey={siteApiKey} />
      </Suspense>
    </LayoutWrapper>
  );

  return googleClientId ? (
    <GoogleOAuthProvider clientId={googleClientId}>{body}</GoogleOAuthProvider>
  ) : (
    body
  );
}
