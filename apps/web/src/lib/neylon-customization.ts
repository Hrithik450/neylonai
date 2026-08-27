import { defineWidgetCustomization } from "@neylonai/sdk/embed";

/**
 * Code-owned widget customization for Neylon's own site — CONTENT only.
 *
 * Theme is deliberately absent. Colors, logo, font, gradients, launcher
 * position and tagline are branding, and branding is a human's job in the
 * Neylon dashboard — never code. The SDK enforces this: `defineWidgetCustomization`
 * omits `branding` from its type, and the runtime merge always takes branding
 * from the dashboard-fetched config, so a code-set theme can't win even if forced.
 *
 * This is exactly what a customer's coding agent is told to do: write the
 * widget's voice (`messages`) and behavior, and leave the look to the dashboard.
 */
export const neylonWidgetCustomization = defineWidgetCustomization({
  messages: {
    welcomeGreeting: "Hi {name} 👋",
    introMessages: [
      "Know why visitors leave. Ask us anything.",
      "Instant answers from the Neylon AI knowledge base.",
      "Start for free — no credit card needed.",
    ],
    askTitle: "Ask about Neylon AI",
    askSubtitle: "Instant answers from our knowledge base",
    feedbackTitle: "Talk to the team",
    feedbackSubtitle:
      "We escalate with full context so you don't repeat yourself",
    inputPlaceholder: "Ask a question…",
    suggestedQuestions: [
      "How does proactive engagement work?",
      "What's included in the free plan?",
      "How do I install the widget on my site?",
      "How is Neylon AI different from Intercom?",
    ],
    faqs: [
      {
        question: "What can Neylon AI do for my site?",
        answer:
          "Neylon watches visitors in real time, starts conversations at the right moment, answers questions 24/7 from your own content, and alerts your team when a human is needed.",
      },
      {
        question: "Is there a free plan?",
        answer:
          "Yes — Neylon AI has a free tier. Paid plans start at $19/mo and unlock proactive engagement, custom branding, and higher usage limits.",
      },
      {
        question: "How long does setup take?",
        answer:
          "Under five minutes. Add a snippet or use our SDK, share your website or docs, and your assistant is live — no engineering sprint needed.",
      },
      {
        question: "How do I talk to a real person?",
        answer:
          "Use the 'Talk to the team' card on the Home tab. We escalate with full conversation context so you never have to repeat yourself.",
      },
    ],
  },
  features: {
    homeTab: true,
    messagesTab: true,
    contactTab: false,
    voiceInput: true,
  },
  proactive: {
    enabled: true,
    soundEnabled: true,
    initialIdleMs: 800,
  },
  website: {
    visiblePathPrefixes: [],
    hiddenPathPrefixes: [],
    autoOpenPathPrefixes: [],
  },
  defaultOpen: false,
});
