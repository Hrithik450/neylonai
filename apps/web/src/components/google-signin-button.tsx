"use client";

import React from "react";
import { GoogleLogin } from "@react-oauth/google";

import { useGoogleAuthHandler } from "@/hooks/use-google-auth-handler";

type GoogleSignInButtonProps = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Google Identity Services renders its button inside a cross-origin iframe, so
 * it can neither be restyled nor triggered with a synthetic `.click()`. To keep
 * our own design, the real Google button is scaled up and layered on top of the
 * custom markup at zero opacity: every click lands on Google's iframe.
 */
export function GoogleSignInButton({
  children,
  className,
  style,
}: GoogleSignInButtonProps) {
  const { handleLogin } = useGoogleAuthHandler();

  return (
    <span
      className={className}
      style={{
        position: "relative",
        display: "inline-flex",
        overflow: "hidden",
        cursor: "pointer",
        ...style,
      }}
    >
      {children}
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0,
        }}
      >
        <span style={{ transform: "scale(4)", transformOrigin: "center" }}>
          <GoogleLogin
            width={220}
            size="large"
            shape="pill"
            text="signup_with"
            onSuccess={handleLogin}
            onError={() => {}}
          />
        </span>
      </span>
    </span>
  );
}
