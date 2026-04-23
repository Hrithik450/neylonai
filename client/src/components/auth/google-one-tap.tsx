"use client";

import React from "react";
import { useSessionStore } from "@/store/session-store";
import { useGoogleAuth } from "@/hooks/use-google-auth";
import { useGoogleOAuth } from "@/providers/google-oauth-provider";

export function GoogleOneTap() {
  const { handleCredential } = useGoogleAuth();
  const { clientId, scriptLoaded } = useGoogleOAuth();

  const { isAuthenticated, sessionChecked } = useSessionStore();

  React.useEffect(() => {
    if (!scriptLoaded || !window.google) return;
    if (isAuthenticated || !sessionChecked) return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredential,
    });

    window.google.accounts.id.prompt((notification: any) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        console.log("One Tap skipped:", notification.getNotDisplayedReason());
      }
    });
  }, [scriptLoaded, isAuthenticated, sessionChecked]);

  return null;
}
