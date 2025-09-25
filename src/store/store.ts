import { Thread } from "@/actions/threads/threads.types";
import { create } from "zustand";

/**
 * Store for toggling the Support Widget open/closed.
 *
 * @interface SupportWidgetToggleStore
 * @property {boolean} isOpen - Whether the support widget is currently open.
 * @property {(flag: boolean) => void} setIsOpen - Function to set the open/close state.
 */
interface SupportWidgetToggleStore {
  isOpen: boolean;
  setIsOpen: (flag: boolean) => void;
}

/**
 * Store for managing chat threads inside the Support Widget.
 *
 * @interface ThreadStore
 * @property {Thread[] | null} threads - All available chat threads, or `null` if none are loaded.
 * @property {(threads: Thread[] | Thread) => void} setThreads - Replace the thread list or add a single thread.
 * @property {string | null} currentThreadId - ID of the currently active thread, or `null` if none is selected.
 * @property {(id: string | null) => void} setCurrentThreadId - Set or clear the currently active thread by ID.
 */
interface ThreadStore {
  threads: Thread[] | null;
  setThreads: (threads: Thread[] | Thread) => void;
  currentThreadId: string | null;
  setCurrentThreadId: (id: string | null) => void;
}

/**
 * Zustand store for toggling the Support Widget open or closed.
 *
 * @remarks
 * Use this hook in your components to read or update the widget’s state:
 * ```ts
 * const { isOpen, setIsOpen } = useSupportWidgetToggleStore();
 * ```
 *
 * @property {boolean} isOpen
 *   Whether the support widget is currently open.
 * @property {(flag: boolean) => void} setIsOpen
 *   Function to set the open/close state.
 */
export const useSupportWidgetToggleStore = create<SupportWidgetToggleStore>(
  (set) => ({
    isOpen: false,
    setIsOpen: (flag) => set({ isOpen: flag }),
  })
);

/**
 * Zustand store for managing chat threads and the currently active thread.
 *
 * @remarks
 * Usage example:
 * ```ts
 * const {
 *   threads,
 *   setThreads,
 *   currentThreadId,
 *   setCurrentThreadId
 * } = useThreadStore();
 * ```
 *
 * @property {Thread[] | null} threads
 *   The list of chat threads. `null` if no threads have been loaded yet.
 *
 * @property {(threads: Thread[] | Thread) => void} setThreads
 *   Add or update one or more threads. Existing threads are merged by `id`.
 *
 * @property {string | null} currentThreadId
 *   ID of the currently active thread, or `null` if none is selected.
 *
 * @property {(id: string | null) => void} setCurrentThreadId
 *   Set the active thread’s ID, or clear it by passing `null`.
 */
export const useThreadStore = create<ThreadStore>((set, get) => ({
  threads: null,
  setThreads: (newThreads) => {
    const currentThreads = get().threads;

    const newThreadsArray = Array.isArray(newThreads)
      ? newThreads
      : [newThreads];

    const threadMap = new Map<string, Thread>();
    if (currentThreads)
      currentThreads.forEach((thread) => {
        threadMap.set(thread.id, thread);
      });

    newThreadsArray.forEach((thread) => {
      threadMap.set(thread.id, thread);
    });

    set({ threads: Array.from(threadMap.values()) });
  },
  currentThreadId: null,
  setCurrentThreadId: (id) => set({ currentThreadId: id }),
}));
