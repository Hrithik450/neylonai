import { Thread } from "@/actions/threads/threads.types";
import { devtools } from "zustand/middleware";
import { create } from "zustand";
import {
  Message,
  NewMessage,
} from "@/actions/thread_messages/thread_messages.types";
import { messageSets } from "@/lib/constants";

export enum TabType {
  Home = "Home",
  Messages = "Messages",
  Contact = "Contact",
  Settings = "Settings",
}

export interface Screen {
  component: React.ComponentType<any>;
  props?: Record<string, any>;
}

export interface TabState {
  stack: Array<Screen>;
}

interface SupportWidgetToggleStore {
  isOpen: boolean;
  isCollapse: boolean;
  setIsOpen: (flag: boolean) => void;
  setCollapse: (flag: boolean) => void;
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
  updateMessage: (updater: (prev: NewMessage[]) => NewMessage[]) => void;
}

export const assistantEnum = [
  "internal_assistant",
  "customer_service_assistant",
  "resume_assistant",
] as const;

export const roleEnum = [
  "business_owner",
  "student",
  "explorer",
  "admin",
] as const;

export const AssistantDisplayMap: Record<AssistantKey, string> = {
  internal_assistant: "Internal Assistant",
  customer_service_assistant: "Customer Service Assistant",
  resume_assistant: "Resume Assistant",
};

export const RoleDisplayMap: Record<RoleKey, string> = {
  business_owner: "Business Owner",
  student: "Student",
  explorer: "Explorer",
  admin: "Admin",
};

export const RoleAssistantMap: Record<RoleKey, AssistantKey[]> = {
  business_owner: ["customer_service_assistant"],
  student: ["internal_assistant", "resume_assistant"],
  explorer: ["internal_assistant", "customer_service_assistant"],
  admin: ["internal_assistant"],
};

export type AssistantKey = (typeof assistantEnum)[number];
export type RoleKey = (typeof roleEnum)[number];

interface UserStore {
  tokens: number;
  resumeTokens: number;
  role: RoleKey | null;
  assistant: AssistantKey;
  currentUserId: string | null;
  setTokens: (tokens: number) => void;
  setResumeTokens: (tokens: number) => void;
  setRole: (role: RoleKey) => void;
  setAssistant: (assistant: AssistantKey) => void;
  setCurrentUserId: (id: string) => void;
}

interface InputStore {
  file: File | null;
  input: string;
  setInput: (value: string) => void;
  disableInput: boolean;
  setFile: (file: File | null) => void;
  setDisableInput: (value: boolean) => void;
}

interface AssistantStore {
  assistantTyping: boolean;
  thinkingPhase: keyof typeof messageSets;
  setAssistantTyping: (value: boolean) => void;
  setThinkingPhase: (value: keyof typeof messageSets) => void;
}

interface ErrorStore {
  status: "error" | "saving" | "saved" | null;
  setStatus: (status: "error" | "saving" | "saved" | null) => void;
  message: string | null;
  setMessage: (message: string | null) => void;
}

interface NavigationStore {
  activeTab: TabType;
  tabStacks: Record<TabType, TabState>;
  setTabStacks: (stacks: Record<TabType, TabState>) => void;
  pushScreen: (tab: TabType, screen: Screen) => void;
  popScreen: (tab: TabType) => void;
  switchTab: (tab: TabType) => void;
}

export const useSupportWidgetToggleStore = create<SupportWidgetToggleStore>(
  (set) => ({
    isOpen: false,
    isCollapse: true,
    setIsOpen: (flag) => set({ isOpen: flag }),
    setCollapse: (flag) => set({ isCollapse: flag }),
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
    activeTab: TabType.Home,
    tabStacks: {
      [TabType.Home]: { stack: [] },
      [TabType.Messages]: { stack: [] },
      [TabType.Contact]: { stack: [] },
      [TabType.Settings]: { stack: [] },
    },
    setTabStacks: (stacks) => set({ tabStacks: stacks }),
    pushScreen: (tab, screen) =>
      set((state) => {
        const newStacks = { ...state.tabStacks };
        newStacks[tab].stack.push(screen);
        return { activeTab: tab, tabStacks: newStacks };
      }),
    popScreen: (tab) =>
      set((state) => {
        const newStacks = { ...state.tabStacks };
        if (newStacks[tab].stack.length > 1) newStacks[tab].stack.pop();
        return { tabStacks: newStacks };
      }),
    switchTab: (tab) => set({ activeTab: tab }),
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
  file: null,
  setInput: (value) => set({ input: value }),
  disableInput: false,
  setFile: (file) => set({ file: file }),
  setDisableInput: (value) => set({ disableInput: value }),
}));

export const useUserStore = create<UserStore>((set) => ({
  tokens: 0,
  role: null,
  resumeTokens: 0,
  currentUserId: null,
  assistant: "internal_assistant",
  setRole: (role) => set({ role: role }),
  setTokens: (tokens) => set({ tokens: tokens }),
  setCurrentUserId: (id) => set({ currentUserId: id }),
  setAssistant: (assistant) => set({ assistant: assistant }),
  setResumeTokens: (resumeTokens) => set({ resumeTokens: resumeTokens }),
}));

export const useAssistantStore = create<AssistantStore>((set) => ({
  assistantTyping: false,
  thinkingPhase: "default",
  setThinkingPhase: (value) => set({ thinkingPhase: value }),
  setAssistantTyping: (value) => set({ assistantTyping: value }),
}));
