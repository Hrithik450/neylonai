"use client";

import { SuccessAlert } from "@/components/success-alert";
import { FailureAlert } from "@/components/failure-alert";
import { useErrorStore } from "@/store/store";
import { Session } from "next-auth";
import React from "react";

export const SessionContext = React.createContext<Session | null>(null);

export function LayoutWrapper({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  const { status, message, setStatus, setMessage } = useErrorStore();

  return (
    <SessionContext.Provider value={session}>
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
    </SessionContext.Provider>
  );
}
