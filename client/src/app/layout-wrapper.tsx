"use client";

import React, { useEffect } from "react";
import { useErrorStore } from "@/store/store";
import { useSessionStore } from "@/store/session-store";
import { SuccessAlert } from "@/components/success-alert";
import { FailureAlert } from "@/components/failure-alert";
import { SessionResponse } from "@/lib/types/request-response";
import { BASE_URL } from "@/lib/services/google-auth";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { status, message, setStatus, setMessage } = useErrorStore();
  const { setSessionChecked, setLoading, setUser } = useSessionStore();

  useEffect(() => {
    const fetchSession = async () => {
      try {
        setLoading(true);

        const response = await fetch(`${BASE_URL}/api/users/me/`, {
          credentials: "include",
        });
        const responseData: SessionResponse = await response.json();

        if (responseData.data) {
          setUser(responseData.data.user);
        }
      } catch (err) {
        setUser(null);
        console.error("session error: ", err);
      } finally {
        setLoading(false);
        setSessionChecked(true);
      }
    };

    fetchSession();
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
