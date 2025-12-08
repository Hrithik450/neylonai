import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import type { User } from "@/lib/types/types";

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

export const useSessionStore = create<SessionStore>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        sessionChecked: false,

        setUser: (user) =>
          set({
            user,

            isAuthenticated: Boolean(user),
          }),

        setLoading: (value) =>
          set({
            isLoading: value,
          }),

        setAuthenticated: (value) =>
          set({
            isAuthenticated: value,
          }),

        setSessionChecked: (value) =>
          set({
            sessionChecked: value,
          }),

        clearSession: () =>
          set({
            user: null,
            isAuthenticated: false,
            sessionChecked: false,
          }),
      }),
      {
        name: "neylon-session",
      },
    ),
  ),
);
