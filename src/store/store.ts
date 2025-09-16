import { create } from "zustand";

interface SupportWidgetToggleStore {
  isOpen: boolean;
  setIsOpen: (flag: boolean) => void;
}

export const useSupportWidgetToggleStore = create<SupportWidgetToggleStore>(
  (set) => ({
    isOpen: false,
    setIsOpen: (flag) => set({ isOpen: flag }),
  })
);
