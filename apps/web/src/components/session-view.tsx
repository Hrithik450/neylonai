"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { User } from "@neylonai/sdk";
import { useSessionStore } from "@/store/session-store";

export interface SessionView {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const SessionViewContext = createContext<SessionView | null>(null);

/**
 * Publishes the request's cookie session so server HTML and the first client
 * render agree. Without this, auth-dependent UI paints signed-out on every
 * reload and corrects itself only after the store loads.
 */
export function SessionViewProvider({
  initialUser,
  children,
}: {
  initialUser: User | null;
  children: React.ReactNode;
}) {
  const setUser = useSessionStore((state) => state.setUser);
  const storeUser = useSessionStore((state) => state.user);
  const isLoading = useSessionStore((state) => state.isLoading);
  const [seeded, setSeeded] = useState(false);
  const seededRef = useRef(false);

  useEffect(() => {
    // Seed once per document: later sign-in/sign-out must not be overwritten by
    // a cached router payload carrying the original cookie state.
    if (seededRef.current) return;
    seededRef.current = true;
    setUser(initialUser);
    setSeeded(true);
  }, [initialUser, setUser]);

  const user = seeded ? storeUser : initialUser;
  const value = useMemo<SessionView>(
    () => ({ user, isAuthenticated: Boolean(user), isLoading }),
    [isLoading, user],
  );

  return (
    <SessionViewContext.Provider value={value}>
      {children}
    </SessionViewContext.Provider>
  );
}

/** Session for rendering. Falls back to the store outside the site shell. */
export function useSessionView(): SessionView {
  const provided = useContext(SessionViewContext);
  const storeUser = useSessionStore((state) => state.user);
  const isLoading = useSessionStore((state) => state.isLoading);
  return (
    provided ?? {
      user: storeUser,
      isAuthenticated: Boolean(storeUser),
      isLoading,
    }
  );
}
