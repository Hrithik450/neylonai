import { create } from "zustand";

/** Pending click-through: open widget and auto-send this text. */
interface ProactivePendingStore {
  pendingQuestion: string | null;
  setPendingQuestion: (text: string | null) => void;
  consumePendingQuestion: () => string | null;
}

export const useProactivePendingStore = create<ProactivePendingStore>(
  (set, get) => ({
    pendingQuestion: null,
    setPendingQuestion: (text) => set({ pendingQuestion: text }),
    consumePendingQuestion: () => {
      const text = get().pendingQuestion;
      set({ pendingQuestion: null });
      return text;
    },
  }),
);
