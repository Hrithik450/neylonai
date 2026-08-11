import {
  Bot,
  Cpu,
  Sparkles,
  CircuitBoard,
  Brain,
  Workflow,
  Binary,
  Gauge,
  Atom,
  MessageSquare,
} from "lucide-react";

export const HomeScreens = {
  Home: "HomeScreen",
} as const;

export const MessagesScreens = {
  Messages: "MessagesScreen",
  Threads: "ThreadsScreen",
} as const;

export const ContactScreens = {
  Contact: "ContactScreen",
} as const;

export type HomeScreensType = (typeof HomeScreens)[keyof typeof HomeScreens];

export type MessagesScreensType =
  (typeof MessagesScreens)[keyof typeof MessagesScreens];

export type ContactScreensType =
  (typeof ContactScreens)[keyof typeof ContactScreens];

export const WidgetScreens = {
  HomeScreens,
  MessagesScreens,
  ContactScreens,
};

export type WidgetScreenType =
  | HomeScreensType
  | MessagesScreensType
  | ContactScreensType;

export const WidgetTabs = {
  Home: "Home",
  Messages: "Messages",
  Contact: "Contact",
} as const;

export type WidgetTabType = (typeof WidgetTabs)[keyof typeof WidgetTabs];

export const robotIcons = [
  Bot,
  Cpu,
  Sparkles,
  CircuitBoard,
  Brain,
  Workflow,
  Binary,
  Gauge,
  Atom,
  MessageSquare,
];

/** Fallback typing lines when the server has not sent thinkingTips yet. */
export const DEFAULT_THINKING_MESSAGES = [
  "Analyzing your request...",
  "Parsing semantic intent...",
  "Building reasoning context...",
  "Cross-checking related data...",
  "Synthesizing coherent insight...",
  "Formulating response structure...",
  "Finalizing output...",
  "Verifying contextual consistency...",
  "Refining response precision...",
  "Applying adaptive reasoning model...",
  "Reviewing logical flow integrity...",
  "Ensuring alignment with prompt constraints...",
  "Performing final validation...",
] as const;
