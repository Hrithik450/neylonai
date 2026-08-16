import React, { Suspense } from "react";
import { Navbar } from "@/components/navigation/navbar";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { SupportWidgetHost } from "@/components/support-widget-host";
import { getSiteWidgetApiKey } from "@/server/site-widget";
import { OnboardingOverlay } from "@/components/landing-page/onboarding-overlay";
import { SessionViewProvider } from "@/components/session-view";
import { getSessionFromCookies } from "@/server/auth-cookies";
import { UsersRepository } from "@neylonai/domain/users";
import { landingFontClassName } from "@/assets/fonts";
import {
  OrganizationJsonLd,
  WebsiteJsonLd,
  SoftwareApplicationJsonLd,
} from "../jsonld";

import { LayoutWrapper } from "../layout-wrapper";
import { TrackingProvider } from "@/components/landing-page/tracking-provider";

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
  const sessionUser = await getSessionFromCookies();
  // Cookie is a login-time snapshot; onboarding progress lives on the row.
  const row = sessionUser
    ? await UsersRepository.findById(sessionUser.id)
    : null;
  const initialUser =
    sessionUser && row
      ? {
          ...sessionUser,
          has_been_onboarded: row.has_been_onboarded,
          onboarding_step: row.onboarding_step,
        }
      : sessionUser;

  const body = (
    <LayoutWrapper>
      <OrganizationJsonLd />
      <WebsiteJsonLd />
      <SoftwareApplicationJsonLd />
      <SessionViewProvider initialUser={initialUser}>
        <TrackingProvider>
          <Suspense fallback={null}>
            <div className={landingFontClassName}>
              <Navbar />
              {children}
              <OnboardingOverlay />
            </div>
            <SupportWidgetHost apiKey={siteApiKey} />
          </Suspense>
        </TrackingProvider>
      </SessionViewProvider>
    </LayoutWrapper>
  );

  return googleClientId ? (
    <GoogleOAuthProvider clientId={googleClientId}>{body}</GoogleOAuthProvider>
  ) : (
    body
  );
}
