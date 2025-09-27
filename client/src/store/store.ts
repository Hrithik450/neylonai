import { Thread } from "@/actions/threads/threads.types";
import { devtools } from "zustand/middleware";
import { create } from "zustand";
import {
  Message,
  NewMessage,
} from "@/actions/thread_messages/thread_messages.types";

/**
 * Represents a screen inside a tab stack.
 *
 * @interface Screen<any>
 * @property {React.FC<any>} component - The React component to render for this screen.
 * @property {any} [props] - Optional props to pass to the component.
 */
export interface Screen {
  component: React.FC<any>;
  props?: any;
}

/**
 * Represents the navigation stack for a single tab.
 *
 * @interface TabState
 * @property {Screen<any>[]} stack - Array of screens representing the current stack for the tab.
 */
export interface TabState {
  stack: Array<Screen>;
}

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

interface ThreadMessageStore {
  messages: NewMessage[] | null;
  setMessages: (messages: Message[]) => void;
  updateMessage: (updater: (prev: NewMessage[] | null) => NewMessage[]) => void;
}

interface UserStore {
  tokens: number;
  setTokens: (tokens: number) => void;
  currentUserId: string | null;
  setCurrentUserId: (id: string) => void;
}

interface InputStore {
  input: string;
  setInput: (value: string) => void;
  disableInput: boolean;
  setDisableInput: (value: boolean) => void;
}

interface AssistantStore {
  isAssistantTyping: boolean;
  setIsAssistantTyping: (value: boolean) => void;
}

interface ErrorStore {
  status: "error" | "saving" | "saved" | null;
  setStatus: (status: "error" | "saving" | "saved" | null) => void;
  message: string | null;
  setMessage: (message: string | null) => void;
}

interface NavigationStore {
  tabStacks: Array<TabState>;
  pushScreen: (tabIndex: number, screen: Screen) => void;
  popScreen: (tabIndex: number) => void;
  setTabStacks: (stacks: Array<TabState>) => void;
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

export const useThreadMessageStore = create<ThreadMessageStore>()(
  devtools((set, get) => ({
    messages: null,
    setMessages: (messages) => {
      set({ messages: messages });
    },
    updateMessage: (updater) => {
      const prev = get().messages ?? [];
      const updated = updater(prev);
      set({ messages: updated });
    },
  }))
);

export const useNavigationStore = create<NavigationStore>()(
  devtools((set) => ({
    tabStacks: [],
    setTabStacks: (stacks) => set({ tabStacks: stacks }),
    pushScreen: (tabIndex, screen) =>
      set((state) => {
        const newStacks = [...state.tabStacks];
        newStacks[tabIndex].stack.push(screen);
        return { tabStacks: newStacks };
      }),
    popScreen: (tabIndex) =>
      set((state) => {
        const newStacks = [...state.tabStacks];
        if (newStacks[tabIndex].stack.length > 1) {
          newStacks[tabIndex].stack.pop();
        }
        return { tabStacks: newStacks };
      }),
  }))
);

export const useErrorStore = create<ErrorStore>((set) => ({
  status: null,
  setStatus: (status) => set({ status }),
  message: null,
  setMessage: (message) => set({ message }),
}));

export const useInputStore = create<InputStore>((set) => ({
  input: "",
  setInput: (value) => set({ input: value }),
  disableInput: false,
  setDisableInput: (value) => set({ disableInput: value }),
}));

export const useUserStore = create<UserStore>((set) => ({
  tokens: 0,
  setTokens: (tokens) => set({ tokens: tokens }),
  currentUserId: null,
  setCurrentUserId: (id) => set({ currentUserId: id }),
}));

export const useAssistantStore = create<AssistantStore>((set) => ({
  isAssistantTyping: false,
  setIsAssistantTyping: (value) => set({ isAssistantTyping: value }),
}));
