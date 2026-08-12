import { create } from "zustand";

interface ErrorStore {
  status: "error" | "saving" | "saved" | null;
  setStatus: (status: "error" | "saving" | "saved" | null) => void;
  message: string | null;
  setMessage: (message: string | null) => void;
}

export const useErrorStore = create<ErrorStore>((set) => ({
  status: null,
  setStatus: (status) => set({ status }),
  message: null,
  setMessage: (message) => set({ message }),
}));
