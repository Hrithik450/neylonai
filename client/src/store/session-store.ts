import { create } from "zustand";
import { devtools } from "zustand/middleware";

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: string;
  profile_image?: string | null;
}

interface SessionStore {
  user: SessionUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionChecked: boolean;

  setUser: (user: SessionUser | null) => void;
  setAuthenticated: (value: boolean) => void;
  setLoading: (value: boolean) => void;
  setSessionChecked: (value: boolean) => void;
}

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

    setLoading: (value) =>
      set({
        isLoading: value,
      }),

    setAuthenticated: (value) =>
      set({
        isAuthenticated: value,
      }),

    setSessionChecked: (value) => set({ sessionChecked: value }),
  })),
);
