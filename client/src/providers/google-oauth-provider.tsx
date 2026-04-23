"use client";

import {
  GsiScriptOptions,
  useLoadGsiScript,
} from "@/hooks/use-load-gsi-script";
import React from "react";

interface GoogleOAuthContextProps {
  clientId: string;
  scriptLoaded: boolean;
}

const GoogleOAuthContext = React.createContext<GoogleOAuthContextProps>(null!);

interface GoogleOAuthProviderProps extends GsiScriptOptions {
  clientId: string;
  children: React.ReactNode;
}

export function GoogleOAuthProvider({
  clientId,
  nonce,
  locale,
  onLoad,
  onError,
  children,
}: GoogleOAuthProviderProps) {
  const scriptLoaded = useLoadGsiScript({
    nonce,
    onLoad,
    onError,
    locale,
  });

  const contextValue = React.useMemo(
    () => ({
      clientId,
      scriptLoaded,
    }),
    [clientId, scriptLoaded],
  );

  return (
    <GoogleOAuthContext.Provider value={contextValue}>
      {children}
    </GoogleOAuthContext.Provider>
  );
}

export function useGoogleOAuth() {
  const context = React.useContext(GoogleOAuthContext);
  if (!context) {
    throw new Error(
      "Google OAuth components must be used within GoogleOAuthProvider",
    );
  }
  return context;
}
