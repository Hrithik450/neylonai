import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface InputStore {
  input: string;
  setInput: (value: string) => void;

  disableInput: boolean;
  setDisableInput: (value: boolean) => void;
}

export const useInputStore = create<InputStore>()(
  devtools((set) => ({
    input: "",
    setInput: (value) => set({ input: value }),

    disableInput: false,
    setDisableInput: (value) => set({ disableInput: value }),
  })),
);
