# @neylonai/sdk

Public browser SDK for Neylon AI (`SupportWidget` + API client).

```bash
pnpm add @neylonai/sdk
```

Framework-agnostic mount (Vue, Angular, Svelte, vanilla JS, or any browser app):

```ts
import { mountSupportWidget } from "@neylonai/sdk/embed";

const widget = await mountSupportWidget({
  config: {
    apiKey: import.meta.env.VITE_NEYLONAI_API_KEY,
    pagePath: window.location.pathname,
  },
});

widget.update({ config: { apiKey: "nk_live_…", user: currentUser } });
widget.unmount();
```

## Typed section keys

After a website crawl, generate path-scoped TypeScript literals so section
tracking only accepts keys that exist for that page:

```bash
npx neylonai-generate-sections \
  --api-key "$NEXT_PUBLIC_NEYLONAI_API_KEY" \
  --out ./src/neylon-sections.ts
```

```ts
import { useEffect } from "react";
import {
  neylonSectionKeys,
  observeNeylonSection,
} from "./neylon-sections";

useEffect(() => {
  const el = document.getElementById("pricing");
  if (!el) return;
  return observeNeylonSection(el, {
    pagePath: "/",
    sectionKey: neylonSectionKeys["/"][0],
    sectionLabel: "Pricing",
  });
}, []);
```

Re-run the command whenever a crawl changes sections. The generated file is
deterministic: identical manifests produce identical TypeScript.

The embed bundles and isolates its React implementation and widget styles in
Shadow DOM. Host applications do not configure React or Tailwind.

React applications may instead use the component API:

```tsx
import {
  SupportWidget,
  defineWidgetCustomization,
} from "@neylonai/sdk/react";

const customization = defineWidgetCustomization({
  branding: {
    primaryTextBackground: "var(--primary, #111827)",
    askButtonTextColor: "var(--primary-foreground, #ffffff)",
    font: { source: "system", family: "var(--font-sans, system-ui)" },
  },
});

<SupportWidget
  config={{
    apiKey: process.env.NEXT_PUBLIC_NEYLONAI_API_KEY,
    customization,
    // optional: user, pagePath from your existing auth/router
  }}
/>
```

The SDK talks to the Neylon AI HTTP API only. It has no private `@neylonai/*` runtime dependencies.
