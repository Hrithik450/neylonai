export const WIDGET_CODING_AGENT_SKILL = `# Neylon AI widget

**CRITICAL: SDK functions handle all configuration internally. Do NOT add extra props like threshold, minDwellMs, or timing parameters. Only pass the documented required fields.**

**Appearance, copy, and behavior are NOT configured in code.** Colors, logo,
fonts, layout, welcome copy, FAQs, suggested questions, tabs, and proactive
settings are all owned by the Neylon dashboard and load automatically at
runtime. Never hardcode them and never pass a \`customization\` object. Your job
is only to install the widget and feed it the three live values it cannot know
by itself: the API key, the signed-in user, and the current page path.

1. Inspect \`package.json\`, imports, and the app shell. Reuse \`@neylonai/sdk\`
   and any existing widget mount when present. Install only when missing. Never
   mount the widget twice.
2. Inspect the current application for what you need to wire up: package
   manager, env-var convention, auth flow, and router.
3. Mount the widget once with the app's public API key.

\`\`\`ts
import { mountSupportWidget } from "@neylonai/sdk/embed";

const widget = await mountSupportWidget({
  config: {
    apiKey: process.env.NEYLONAI_API_KEY, // use the current app's public env syntax
  },
});
\`\`\`

4. Mount once in the framework's browser lifecycle and call
   \`widget.unmount()\` during cleanup. Do not add React or Tailwind setup to the
   host application. If the user asks to change colors, copy, greetings, FAQs,
   or proactive behavior, do not edit code — point them to the Neylon
   Dashboard → Widget page.
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
    user: toNeylonUser(currentUser),
    pagePath: getNeylonPagePath(), // or a live router pathname hook value
  },
});
\`\`\`

7. After code is configured, tell the user to open the app's ignored local env
   file and set a **public** API key variable using that stack's convention.
   Examples:
   Next.js: \`.env.local\` with \`NEXT_PUBLIC_NEYLONAI_API_KEY\`
   Vite: \`.env\` / \`.env.local\` with \`VITE_NEYLONAI_API_KEY\`
   CRA: \`.env\` with \`REACT_APP_NEYLONAI_API_KEY\`
   Pass that value into \`config.apiKey\` with the framework's env access
   (\`process.env.*\` or \`import.meta.env.*\`). Never commit a real key. If
   asked where to get one: Neylon Dashboard → Settings → API keys → Create an
   API key → copy it.
8. Do not run a verification pass yourself. Tell the user explicitly to:
   Confirm the widget is mounted and loading its dashboard configuration.
   Open the env file for their stack, set the public Neylon API key, and wire
   it to \`config.apiKey\`.
   Set colors, copy, FAQs, and proactive behavior in Neylon Dashboard → Widget.
   Verify launcher contrast, open panel, greeting, FAQs, chat input, and
   mobile placement.`;
