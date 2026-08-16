import { create } from "zustand";
import { devtools } from "zustand/middleware";

import type { User } from "@neylonai/sdk";

interface SessionStore {
  user: User | null;
  isLoading: boolean;
  sessionChecked: boolean;
  isAuthenticated: boolean;

  setUser: (user: User | null) => void;
  setAuthenticated: (value: boolean) => void;
  setLoading: (value: boolean) => void;
  setSessionChecked: (value: boolean) => void;
  clearSession: () => void;
}

/**
 * In-memory only. The session cookie is authoritative and is read on the server
 * for the first render, so persisting a copy here would only serve stale users.
 */
export const useSessionStore = create<SessionStore>()(
  devtools((set) => ({
    user: null,
    isLoading: false,
    isAuthenticated: false,
    sessionChecked: false,

    setUser: (user) =>
      set({
        user,
        isAuthenticated: Boolean(user),
      }),

    setLoading: (value) => set({ isLoading: value }),

    setAuthenticated: (value) => set({ isAuthenticated: value }),

    setSessionChecked: (value) => set({ sessionChecked: value }),

    clearSession: () =>
      set({
        user: null,
        isAuthenticated: false,
        sessionChecked: false,
      }),
  })),
);
