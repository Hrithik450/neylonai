import type { Thread, ThreadMessage } from "@neylonai/sdk";

/** Dummy threads for the Chats tab (dashboard mock only). */
export const STATIC_DEMO_THREADS: Thread[] = [
  {
    id: "demo-thread-1",
    user: "demo-visitor",
    title: "Customize widget colors",
    created_at: "2026-08-11T10:00:00.000Z",
  },
  {
    id: "demo-thread-2",
    user: "demo-visitor",
    title: "Talk to the team",
    created_at: "2026-08-10T16:22:00.000Z",
  },
];

/** Dummy messages for conversation bubbles (dashboard mock only). */
export const STATIC_DEMO_MESSAGES: ThreadMessage[] = [
  {
    id: "demo-m1",
    thread_id: "demo-thread-1",
    role: "user",
    content: "How do I customize the widget colors?",
    created_at: "2026-08-11T10:00:00.000Z",
  },
  {
    id: "demo-m2",
    thread_id: "demo-thread-1",
    role: "assistant",
    content:
      "Open **Appearance** on the left. Heading, Ask button, cards, tabs, and message bubbles update in this preview as you edit — publish when you’re happy.",
    created_at: "2026-08-11T10:00:06.000Z",
  },
  {
    id: "demo-m3",
    thread_id: "demo-thread-1",
    role: "user",
    content: "Can visitors escalate to a person?",
    created_at: "2026-08-11T10:00:18.000Z",
  },
  {
    id: "demo-m4",
    thread_id: "demo-thread-1",
    role: "assistant",
    content:
      "Yes. Use **Talk to the team** on Home, or enable the contact tab under Features when you’re ready.",
    created_at: "2026-08-11T10:00:24.000Z",
  },
];
