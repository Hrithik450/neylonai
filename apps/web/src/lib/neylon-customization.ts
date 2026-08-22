import { defineWidgetCustomization } from "@neylonai/sdk/embed";

/**
 * Hero: warm cream #FFF7F4, near-black #242424, brown-gray #45413F
 *
 * Widget: crisp neutral panel + hero-black actions + forest-green brand accents.
 * Surfaces are cool gray (not cream/peach/coral) so the panel reads as its own layer.
 */
const HERO_CTA = "#242424";
const BRAND_GREEN = "#0E3228";
const NEUTRAL_BODY = "#6B7280";
/** Panel fill — slightly darker than page cream (#FFF7F4). */
const PANEL_TOP = "#E8E8E8";
const PANEL_BOTTOM = "#F0F0F0";
/** Cards / chips — lighter than panel for contrast. */
const NEUTRAL_SURFACE = "#FAFAFA";
const NEUTRAL_BUBBLE = "#F5F5F5";
const NEUTRAL_HUMAN = "#EBEBEB";

/**
 * Code-owned widget customization — premium neutral layer on the warm landing page.
 *
 * Do NOT set branding.logoUrl, branding.font, or layout —
 * those are controlled from the Neylon dashboard.
 */
export const neylonWidgetCustomization = defineWidgetCustomization({
  branding: {
    name: "Neylon AI",
    // Brand green headings (distinct from hero near-black)
    primaryTextColor: BRAND_GREEN,
    // Cool neutral body (not hero warm brown)
    secondaryTextColor: NEUTRAL_BODY,
    // Launcher + Ask CTA — hero filled button colour, visible on cream bg
    primaryTextBackground: HERO_CTA,
    askButtonTextColor: "#ffffff",
    // Gray cards on darker panel (not cream-tinted surfaces)
    secondaryTextBackground: NEUTRAL_SURFACE,
    tabActiveColor: BRAND_GREEN,
    accentColor: "#9CA3AF",
    // Slightly darker panel — separates from page cream (#FFF7F4)
    gradientFrom: PANEL_TOP,
    gradientTo: PANEL_BOTTOM,
    aiMessageBackground: NEUTRAL_BUBBLE,
    humanMessageBackground: NEUTRAL_HUMAN,
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
    initialIdleMs: 800,
  },
  website: {
    visiblePathPrefixes: [],
    hiddenPathPrefixes: [],
    autoOpenPathPrefixes: [],
  },
  defaultOpen: false,
});
