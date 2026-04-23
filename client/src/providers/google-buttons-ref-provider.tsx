"use client";

import React, { createContext, useContext, useRef } from "react";

type GoogleRefsType = {
  desktopButtonRef: React.RefObject<HTMLDivElement | null>;
  mobileButtonRef: React.RefObject<HTMLDivElement | null>;
};

const GoogleRefsContext = createContext<GoogleRefsType | null>(null);

export function GoogleButtonsRefProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const desktopButtonRef = useRef<HTMLDivElement | null>(null);
  const mobileButtonRef = useRef<HTMLDivElement | null>(null);

  return (
    <GoogleRefsContext.Provider value={{ desktopButtonRef, mobileButtonRef }}>
      {children}
    </GoogleRefsContext.Provider>
  );
}

export function useGoogleRefButtons() {
  const ctx = useContext(GoogleRefsContext);
  if (!ctx) throw new Error("useGoogleRefs must be used inside provider");
  return ctx;
}
