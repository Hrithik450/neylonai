import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { Thread, ThreadMessage } from "@/lib/types/types";

interface ThreadStore {
  threads: Thread[] | null;
  setThreads: (threads: Thread[] | Thread) => void;
  currentThreadId: string | null;
  setCurrentThreadId: (id: string | null) => void;
}

interface ThreadMessageStore {
  messages: ThreadMessage[] | null;
  setMessages: (messages: ThreadMessage[]) => void;
  updateMessage: (updater: (prev: ThreadMessage[]) => ThreadMessage[]) => void;
}

export const useThreadStore = create<ThreadStore>()(
  devtools((set, get) => ({
    threads: null,

    setThreads: (threads) => {
      const existingThreads = get().threads ?? [];
      const incomingThreads = Array.isArray(threads) ? threads : [threads];

      const mergedThreads = new Map<string, Thread>();

      [...incomingThreads, ...existingThreads].forEach((thread) => {
        mergedThreads.set(thread.id, thread);
      });

      set({
        threads: Array.from(mergedThreads.values()),
      });
    },

    currentThreadId: null,

    setCurrentThreadId: (id) => {
      set({ currentThreadId: id });
    },
  })),
);

export const useThreadMessageStore = create<ThreadMessageStore>()(
  devtools((set) => ({
    messages: null,

    setMessages: (messages) => {
      set({ messages });
    },

    updateMessage: (updater) => {
      set((state) => ({
        messages: updater(state.messages ?? []),
      }));
    },
  })),
);
