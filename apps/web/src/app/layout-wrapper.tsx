"use client";

import React, { useEffect } from "react";
import { useErrorStore } from "@/store/error-store";
import { useSessionStore } from "@/store/session-store";

import { SuccessAlert } from "@/components/alerts/success-alert";
import { FailureAlert } from "@/components/alerts/failure-alert";

import { getMe } from "@/lib/neylon-session-api";

/** Guards against ping-ponging with the middleware if the retry also fails. */
const RETRY_KEY = "neylonai:auth-redirect-retry";
/** A bounce this soon after a retry means the retry itself failed. */
const RETRY_COOLDOWN_MS = 15_000;

function retriedRecently(path: string): boolean {
  try {
    const raw = sessionStorage.getItem(RETRY_KEY);
    if (!raw) return false;
    const last = JSON.parse(raw) as { path: string; at: number };
    return last.path === path && Date.now() - last.at < RETRY_COOLDOWN_MS;
  } catch {
    return false;
  }
}

/** Only same-origin paths from our own middleware are worth replaying. */
function safeNextPath(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { status, message, setStatus, setMessage } = useErrorStore();
  const { clearSession, setUser } = useSessionStore();

  useEffect(() => {
    const validateSession = async () => {
      // `next` is only ever set by the middleware when it bounces a protected
      // route back here.
      const url = new URL(window.location.href);
      const bouncedFrom = safeNextPath(url.searchParams.get("next"));

      try {
        const response = await getMe();
        if (!response.success) {
          clearSession();
          sessionStorage.removeItem(RETRY_KEY);
          return;
        }
        // Persisted store state can outlive the row it was cloned from.
        if (response.user) setUser(response.user);

        if (!bouncedFrom) return;

        // The middleware bounced a protected route here because the request
        // carried no session cookie, yet the cookie is clearly live now — a
        // WebKit lag right after sign-up. Replay the navigation once instead of
        // making the user click the same link a second time.
        if (!retriedRecently(bouncedFrom)) {
          sessionStorage.setItem(
            RETRY_KEY,
            JSON.stringify({ path: bouncedFrom, at: Date.now() }),
          );
          window.location.replace(bouncedFrom);
        }
      } catch (err) {
        console.error("network error: ", err);
      }
    };

    validateSession();
  }, []);

  return (
    <main>
      {children}
      {status === "saved" && message && (
        <SuccessAlert
          message={message}
          duration={4000}
          setStatus={setStatus}
          setMessage={setMessage}
        />
      )}
      {status === "error" && message && (
        <FailureAlert
          message={message}
          duration={4000}
          setStatus={setStatus}
          setMessage={setMessage}
        />
      )}
    </main>
  );
}
