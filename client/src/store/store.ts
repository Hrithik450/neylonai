import { Thread } from "@/actions/threads/threads.types";
import { devtools } from "zustand/middleware";
import { create } from "zustand";
import {
  Message,
  NewMessage,
} from "@/actions/thread_messages/thread_messages.types";

export interface Screen {
  component: React.FC<any>;
  props?: any;
}

export interface TabState {
  stack: Array<Screen>;
}

interface SupportWidgetToggleStore {
  isOpen: boolean;
  setIsOpen: (flag: boolean) => void;
}

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
  setTabStacks: (stacks: Array<TabState>) => void;
  pushScreen: (tabIndex: number, screen: Screen) => void;
  popScreen: (tabIndex: number) => void;
}

export const useSupportWidgetToggleStore = create<SupportWidgetToggleStore>(
  (set) => ({
    isOpen: false,
    setIsOpen: (flag) => set({ isOpen: flag }),
  })
);

export const useThreadStore = create<ThreadStore>()(
  devtools((set, get) => ({
    threads: null,
    setThreads: (newThreads) => {
      const currentThreads = get().threads;

      const newThreadsArray = Array.isArray(newThreads)
        ? newThreads
        : [newThreads];

      const threadMap = new Map<string, Thread>();

      newThreadsArray.forEach((thread) => {
        threadMap.set(thread.id, thread);
      });

      if (currentThreads)
        currentThreads.forEach((thread) => {
          if (!threadMap.has(thread.id)) threadMap.set(thread.id, thread);
        });

      set({ threads: Array.from(threadMap.values()) });
    },
    currentThreadId: null,
    setCurrentThreadId: (id) => set({ currentThreadId: id }),
  }))
);

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
