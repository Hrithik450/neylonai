export const WIDGET_CODING_AGENT_SKILL = `# Neylon AI widget

**CRITICAL: SDK functions handle all configuration internally. Do NOT add extra props like threshold, minDwellMs, or timing parameters to observeNeylonSection. Only pass the documented required fields.**

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
   **CRITICAL: DO NOT generate section types or neylon-sections.ts file yourself. DO NOT create dummy section keys or placeholder types.**

   After the customer has imported/connected their website in the Neylon dashboard:
   1. **STOP and ask the user**: "I see you want to add section tracking. Have you completed the Website integration in the Neylon dashboard?"
   2. **Wait for user confirmation** that the website import is complete
   3. **Then tell the user**: "Now I will run the generate command to fetch your actual sections from Neylon"
   4. **Only then run**:

\`\`\`bash
npx neylonai-generate-sections \\
  --api-key "$NEXT_PUBLIC_NEYLONAI_API_KEY" \\
  --out ./src/neylon-sections.ts
\`\`\`

   **Never create section keys manually.** If the command fails or sections are not available, tell the user to:
   - Complete Website setup in the Neylon dashboard first
   - Verify their website has been crawled/imported
   - Then re-run the generate command

Wire **observeNeylonSection** on 3–8 major blocks per content page (home,
pricing, features, product, docs, FAQ). Mount the widget once. Use
\`observeNeylonSection\` directly on each section.

**IMPORTANT: Only pass pagePath, sectionKey, and sectionLabel. Do NOT add threshold, minDwellMs, or any timing parameters - the SDK handles these internally.**

\`\`\`ts
import { useEffect } from "react";
import {
  neylonSectionKeys,
  observeNeylonSection,
} from "./neylon-sections";

useEffect(() => {
  const el = document.getElementById("pricing");
  if (!el) return;
  return observeNeylonSection(el, {
    pagePath: "/pricing",
    sectionKey: neylonSectionKeys["/pricing"][0],
    sectionLabel: "Pricing",
  });
}, []);

// Make sure your section element has the matching id:
<section id="pricing">...</section>
\`\`\`

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
   Confirm Website import is complete and \`neylon-sections.ts\` was generated
   before section tracking is expected to work.
   Verify launcher contrast, open panel, greeting, FAQs, chat input, and
   mobile placement.`;
