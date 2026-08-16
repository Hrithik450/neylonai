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
   After your website integration is set up in Neylon AI, run the generate command to create
   a \`neylon-sections.ts\` file with typed section keys. This file exports
   \`neylonSectionKeys\` and \`observeNeylonSection\` for use in your components.

\`\`\`bash
npx neylonai-generate-sections \\
  --api-key "$NEXT_PUBLIC_NEYLONAI_API_KEY" \\
  --out ./src/neylon-sections.ts
\`\`\`

   If sections are not available yet, tell the user to complete Website setup in the Neylon dashboard, then re-run the command.

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

6. Do not customize branding, behavior, layout, auth mapping, or page path here.
7. Tell the user explicitly to confirm the install and set the public API key
   in their env file.`;
