export const WIDGET_CODING_AGENT_SKILL = `# Neylon AI widget

**CRITICAL: SDK functions handle all configuration internally. Do NOT add extra props like threshold, minDwellMs, or timing parameters. Only pass the documented required fields.**

1. Inspect \`package.json\`, imports, and the app shell. Reuse \`@neylonai/sdk\`
   and any existing widget mount when present. Install only when missing. Never
   mount the widget twice.
2. Inspect the current application: package manager, auth, router, brand name,
   color tokens, product copy, FAQs, and UX tone.
3. Configure the full widget with \`defineWidgetCustomization\` from those
   values: colors, behavior, proactive, and path rules. Do **not** set
   \`branding.logoUrl\`, \`branding.font\`, or \`layout\` (leave defaults; logo,
   fonts, and launcher layout are set in the Neylon dashboard).

\`\`\`ts
import {
  defineWidgetCustomization,
  mountSupportWidget,
} from "@neylonai/sdk/embed";

const customization = defineWidgetCustomization({
  branding: {
    name: "Acme",
    primaryTextColor: "#111827",
    secondaryTextColor: "#4b5563",
    primaryTextBackground: "#111827",
    askButtonTextColor: "#ffffff",
    secondaryTextBackground: "#ffffff",
    tabActiveColor: "#111827",
    accentColor: "#6b7280",
    gradientFrom: "#f3f4f6",
    gradientTo: "#ffffff",
    aiMessageBackground: "transparent",
    humanMessageBackground: "#e5e7eb",
  },
  messages: {
    welcomeGreeting: "Hi {name} 👋",
    introMessages: [
      "Ask anything about our product.",
      "We answer from our knowledge base.",
    ],
    askTitle: "Ask a question",
    askSubtitle: "Instant answers from our knowledge",
    feedbackTitle: "Talk to the team",
    feedbackSubtitle: "We escalate with full context when needed",
    inputPlaceholder: "Ask a question…",
    suggestedQuestions: [
      "What can you help me with?",
      "How do I get started?",
    ],
    faqs: [
      {
        question: "What can this assistant help with?",
        answer: "Product questions and next steps from our knowledge.",
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

const widget = await mountSupportWidget({
  config: {
    apiKey: process.env.NEYLONAI_API_KEY, // use the current app's public env syntax
    customization,
  },
});
\`\`\`

4. Replace every example value from the current application. Mount once in the
   framework's browser lifecycle and call \`widget.unmount()\` during cleanup.
   Do not add React or Tailwind setup to the host application.
5. Inspect the current application's auth flow. If auth exists, create one
   dedicated mapping layer/file that converts their session/user into Neylon's
   required fields and pass it to the widget. If there is no auth, omit \`user\`
   (anonymous is fine). Do not invent a new login system.

\`\`\`ts
// example: lib/neylonUser.ts (adapt to the current app's auth)
export function toNeylonUser(sessionUser: YourAppUser | null) {
  if (!sessionUser) return null;
  return {
    id: sessionUser.id,
    name: sessionUser.name,
    email: sessionUser.email,
    profile_image: sessionUser.image ?? undefined,
  };
}
\`\`\`

6. Create one dedicated page path layer/file that always resolves the current
   route URL for the widget. Use the app's router (or \`window.location\` when
   that is the source of truth). The value must update on navigation so every
   page path reaches the widget accurately. Never hardcode a single path.

\`\`\`ts
// example: lib/neylonPagePath.ts (adapt to the current app's router)
export function getNeylonPagePath(): string {
  // Prefer the framework router pathname; fall back only if needed
  return window.location.pathname;
}
\`\`\`

\`\`\`ts
widget.update({
  config: {
    apiKey: process.env.NEYLONAI_API_KEY, // use the current app's public env syntax
    customization,
    user: toNeylonUser(currentUser),
    pagePath: getNeylonPagePath(), // or a live router pathname hook value
  },
});
\`\`\`

7. **Section tracking (requires a Website integration first).**
   Give 3–8 major blocks a stable \`id\` on \`<section>\` or \`<article>\`
   elements. The Website crawl reads those ids from rendered HTML.

\`\`\`html
<section id="pricing">
  <h2>Pricing</h2>
  ...
</section>
\`\`\`

   The widget auto-tracks marked sections when mounted. No codegen step is
   required.

8. After code is configured, tell the user to open the app's ignored local env
   file and set a **public** API key variable using that stack's convention.
   Examples:
   Next.js: \`.env.local\` with \`NEXT_PUBLIC_NEYLONAI_API_KEY\`
   Vite: \`.env\` / \`.env.local\` with \`VITE_NEYLONAI_API_KEY\`
   CRA: \`.env\` with \`REACT_APP_NEYLONAI_API_KEY\`
   Pass that value into \`config.apiKey\` with the framework's env access
   (\`process.env.*\` or \`import.meta.env.*\`). Never commit a real key. If
   asked where to get one: Neylon Dashboard → Settings → API keys → Create an
   API key → copy it.
9. Do not run a verification pass yourself. Tell the user explicitly to:
   Confirm the widget is configured.
   Open the env file for their stack, set the public Neylon API key, and wire
   it to \`config.apiKey\`.
   Confirm Website import is complete and major page sections have stable
   element \`id\` values before section suggestions are expected to work.
   Verify launcher contrast, open panel, greeting, FAQs, chat input, and
   mobile placement.`;
