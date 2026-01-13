"use client";

import React, { useEffect } from "react";
import { useErrorStore } from "@/store/error-store";
import { useSessionStore } from "@/store/session-store";

import { SuccessAlert } from "@/components/alerts/success-alert";
import { FailureAlert } from "@/components/alerts/failure-alert";

import { BASE_URL } from "@/lib/services/google-auth";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { status, message, setStatus, setMessage } = useErrorStore();
  const { clearSession } = useSessionStore();

  useEffect(() => {
    const validateSession = async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/v1/me/`, {
          credentials: "include",
        });
        if (!response.ok) clearSession();
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
