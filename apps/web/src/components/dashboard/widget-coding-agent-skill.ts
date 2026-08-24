export const WIDGET_CODING_AGENT_SKILL = `# Neylon AI widget

You are integrating the Neylon AI support widget into this project. Your job is
narrow and specific:

1. **Install** the SDK (or reuse it if it's already here).
2. **Get an API key** from the client by asking for it.
3. **Write the widget's content** — greeting, intro, FAQs, suggested questions —
   from this project, so it sounds like this product on day one, not a generic demo.
4. **Wire it into the app** and keep it in sync as the user and route change.

That is the whole job. You do **not** design or theme the widget.

## The one rule that decides everything: code beats the dashboard

Every field you put in \`customization\` **overrides** the client's Neylon
dashboard for that field; every field you leave out flows through from the
dashboard. So the split below is not a style preference — it's mechanical:

- **Set only the content** (\`messages\`). That is your job — make the widget speak
  in this product's voice from the first load.
- **Leave every theme and behavior key out of the code** (\`branding\`, \`layout\`,
  \`proactive\`). Because they're absent, the client's dashboard settings apply. The
  moment you set one in code, you lock the client out of their own dashboard for it.

**CRITICAL: pass only the documented fields below. Never invent props
(\`threshold\`, \`minDwellMs\`, or any timing/pacing knob) — proactive behavior is
the client's, configured in the dashboard, never in code.**

If the client asks to change a color, logo, font, launcher position, or
proactive timing: do not touch code. Point them to **Neylon Dashboard → Widget**.

## Steps

1. **Install or reuse the SDK.** Inspect \`package.json\`, imports, and the app
   shell. Reuse \`@neylonai/sdk\` and any existing widget mount when present;
   install only when missing. Never mount the widget twice.

2. **Get the API key from the client — ask, don't guess.** Say: "Please create a
   publishable API key in Neylon Dashboard → Settings → API keys → Create an API
   key, and paste it here." Store it in the app's git-ignored local env file using
   that stack's convention and read it from there — never inline the literal key,
   never commit it.
   - Next.js: \`.env.local\` → \`NEXT_PUBLIC_NEYLONAI_API_KEY\`
   - Vite: \`.env.local\` → \`VITE_NEYLONAI_API_KEY\`
   - CRA: \`.env\` → \`REACT_APP_NEYLONAI_API_KEY\`
   If they don't have a key yet, stop and wait for it — do not continue with a
   placeholder.

3. **Study the project, then write the content in its voice.** Read the
   landing/marketing pages, README, docs, pricing page, and any existing support
   or contact copy. Pull out: what the product does in one line, who it's for, the
   real questions a visitor would ask, and the tone the product already uses
   (formal, playful, technical). Reuse the product's own words — never invent a
   feature, price, SLA, integration, or guarantee the docs don't state.

4. **Define the content with \`defineWidgetCustomization\` — \`messages\` only.**
   Replace every value with something true about this project; never ship these
   examples verbatim.

\`\`\`ts
import {
  defineWidgetCustomization,
  mountSupportWidget,
} from "@neylonai/sdk/embed";

const customization = defineWidgetCustomization({
  messages: {
    // "{name}" → the signed-in user's first name, or "there" when anonymous.
    welcomeGreeting: "Hi {name} 👋",
    introMessages: [
      "Ask anything about <what this product does>.",
      "Answers come from <this company>'s own docs.",
    ],
    inputPlaceholder: "Ask about <the product>…",
    askTitle: "Ask a question",
    askSubtitle: "Instant answers from our docs",
    feedbackTitle: "Talk to the team",
    feedbackSubtitle: "We escalate with full context when needed",
    // Only the first 3 render as starters — lead with the highest-intent.
    suggestedQuestions: [
      "<a real question a visitor asks about this product>",
      "<a real setup or pricing question>",
      "<a real question about limits, support, or integrations>",
    ],
    // At most 4 FAQs are shown — pick the 4 highest-intent, answer from the docs.
    faqs: [
      {
        question: "<a question this project's own docs answer>",
        answer: "<the answer in 1–2 sentences, in the product's voice>",
      },
    ],
  },
});
\`\`\`

   Optional: only if this project clearly needs a specific tab set, add
   \`features\`. It overrides the dashboard too, so leave it out and let the client
   control tabs unless there's a real reason (e.g. this app has no contact form):

\`\`\`ts
features: { homeTab: true, messagesTab: true, contactTab: false, voiceInput: true },
\`\`\`

5. **Mount once in the framework's browser lifecycle; unmount on cleanup.** Do not
   add React or Tailwind setup to the host application.

\`\`\`ts
const widget = await mountSupportWidget({
  config: {
    apiKey: process.env.NEXT_PUBLIC_NEYLONAI_API_KEY, // use this stack's env syntax
    customization,
  },
});
// during teardown:
widget.unmount();
\`\`\`

6. **Map the app's auth to a Neylon user — or omit it.** If the app has auth,
   create one small mapping file that converts its session user into Neylon's
   fields, and pass it to the widget. If there is no auth, omit \`user\` (anonymous
   is fine). Do not invent a new login system.

\`\`\`ts
// example: lib/neylonUser.ts (adapt to this app's auth)
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

7. **Resolve the live page path.** One small helper that always returns the
   current route and updates on navigation — use the app's router, or
   \`window.location\` when that is the source of truth. Never hardcode a path.

\`\`\`ts
// example: lib/neylonPagePath.ts (adapt to this app's router)
export function getNeylonPagePath(): string {
  return window.location.pathname;
}
\`\`\`

8. **Keep the widget in sync on user/route change.** \`update\` re-renders with the
   props you pass — it does **not** merge — so pass the full config every time,
   including \`apiKey\` and \`customization\`, not just what changed.

\`\`\`ts
widget.update({
  config: {
    apiKey: process.env.NEXT_PUBLIC_NEYLONAI_API_KEY, // use this stack's env syntax
    customization,
    user: toNeylonUser(currentUser),
    pagePath: getNeylonPagePath(), // or a live router pathname hook value
  },
});
\`\`\`

9. **Hand off — don't QA the rendered widget yourself.** Make sure the code
   type-checks and builds, then tell the client to:
   - Confirm the widget appears and the greeting, intro lines, suggested
     questions, and FAQs describe this product correctly.
   - Confirm the API key is set in their env file and not committed.
   - Set colors, logo, font, launcher position, and proactive behavior in
     **Neylon Dashboard → Widget** — those are theirs, not yours.
   - Check the open panel, chat input, and mobile placement.`;
