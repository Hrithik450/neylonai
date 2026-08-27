import React, { Suspense } from "react";
import { Navbar } from "@/components/navigation/navbar";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { SupportWidgetHost } from "@/components/support-widget-host";
import { OnboardingOverlay } from "@/components/landing-page/onboarding-overlay";
import { SessionViewProvider } from "@/components/session-view";
import { getLandingUser } from "@/server/landing-user";
import { landingFontClassName } from "@/assets/fonts";
import {
  OrganizationJsonLd,
  WebsiteJsonLd,
  SoftwareApplicationJsonLd,
  FAQJsonLd,
} from "../jsonld";

import { LayoutWrapper } from "../layout-wrapper";

export default async function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  const initialUser = await getLandingUser();

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <LayoutWrapper>
        <OrganizationJsonLd />
        <WebsiteJsonLd />
        <SoftwareApplicationJsonLd />
        <FAQJsonLd />

        <SessionViewProvider initialUser={initialUser}>
          <Suspense fallback={null}>
            <div className={landingFontClassName}>
              <Navbar />
              {children}
              <OnboardingOverlay />
            </div>

            <SupportWidgetHost />
          </Suspense>
        </SessionViewProvider>
      </LayoutWrapper>
    </GoogleOAuthProvider>
  );
}