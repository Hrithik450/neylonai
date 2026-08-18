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

## Page sections

Give major page blocks a stable `id` on `<section>` or `<article>` elements.
The widget auto-tracks them when mounted — no codegen or manual wiring.

```html
<section id="pricing">
  <h2>Pricing</h2>
  ...
</section>
```

After your Website integration crawls the site, Neylon uses the same element
`id` values as knowledge section keys and proactive suggestion seeds.

For custom hosts without the widget, call `initNeylonSectionAutoTrack()` from
`@neylonai/sdk` once on the page.

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
