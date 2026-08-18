export const DEVELOPER_SDK_INSTALL_SKILL = `# Neylon AI SDK install

**CRITICAL: SDK functions handle all configuration internally. Do NOT add extra props like threshold, minDwellMs, or timing parameters. Only pass the documented required fields.**

1. Inspect \`package.json\` and the app shell. Reuse \`@neylonai/sdk\` when
   present. Install it with the project's package manager only when missing.
2. Call \`mountSupportWidget\` from \`@neylonai/sdk/embed\` exactly once in the
   browser app shell. Use the framework's client-mount lifecycle and call
   \`unmount()\` during cleanup. React and widget styles are internal.

\`\`\`ts
import { mountSupportWidget } from "@neylonai/sdk/embed";

const widget = await mountSupportWidget({
  config: {
    apiKey: process.env.NEYLONAI_API_KEY, // use the current app's public env syntax
  },
});
\`\`\`

3. Detect and follow the framework's public environment variable convention.
   Examples:
   Next.js: \`.env.local\` with \`NEXT_PUBLIC_NEYLONAI_API_KEY\`
   Vite: \`.env\` / \`.env.local\` with \`VITE_NEYLONAI_API_KEY\`
   CRA: \`.env\` with \`REACT_APP_NEYLONAI_API_KEY\`
   Pass that value into \`config.apiKey\`. Never commit a real key.
4. If asked where to get the key: Neylon Dashboard → Settings → API keys →
   Create an API key → copy it.
5. **Section tracking (requires a Website integration first).**
   Give 3–8 major blocks a stable \`id\` on \`<section>\` or \`<article>\` elements
   (home, pricing, features, product, docs, FAQ). The crawl reads those ids
   from rendered HTML and stores suggestions under the same keys.

   **CRITICAL: Use stable kebab-case ids. Avoid layout shell ids like \`root\`
   or \`app\`.**

\`\`\`html
<section id="pricing">
  <h2>Pricing</h2>
  ...
</section>
\`\`\`

   The widget auto-tracks marked sections when mounted. No codegen step and no
   manual \`observePageSection\` calls are required for the default embed.

6. Do not customize branding, behavior, layout, auth mapping, or page path here.
7. Tell the user explicitly to confirm the install and set the public API key
   in their env file.`;
