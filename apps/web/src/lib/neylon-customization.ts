import { defineWidgetCustomization } from "@neylonai/sdk/embed";

/**
 * Code-owned widget customization derived from Neylon AI's own brand.
 * These values override dashboard config so the launcher and panel match
 * the landing site's warm-neutral palette exactly.
 *
 * Do NOT set branding.logoUrl, branding.font, or layout —
 * those are controlled from the Neylon dashboard.
 */
export const neylonWidgetCustomization = defineWidgetCustomization({
  branding: {
    name: "Neylon AI",
    // Near-black primary (#242424) — hero heading + CTA button colour
    primaryTextColor: "#242424",
    // Warm dark brown — hero subtitle colour (#45413F)
    secondaryTextColor: "#45413F",
    // CTA launcher / Ask button fill
    primaryTextBackground: "#242424",
    askButtonTextColor: "#ffffff",
    // FAQ chip / suggestion card surface
    secondaryTextBackground: "#ffffff",
    // Active tab (deep green used for all section headings)
    tabActiveColor: "#0E3228",
    // Inactive tab — same warm muted tone as secondary text
    accentColor: "#45413F",
    // Header gradient mirrors the hero section background
    gradientFrom: "#FFF7F4",
    gradientTo: "#ffffff",
    // Chat bubbles
    aiMessageBackground: "transparent",
    humanMessageBackground: "#FFE8D9",
  },
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
  },
  website: {
    visiblePathPrefixes: [],
    hiddenPathPrefixes: [],
    autoOpenPathPrefixes: [],
  },
  defaultOpen: false,
});
