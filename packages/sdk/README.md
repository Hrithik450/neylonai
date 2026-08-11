# @neylonai/sdk

Public browser SDK for Neylon AI (`SupportWidget` + API client).

```bash
pnpm add @neylonai/sdk
```

```tsx
import { SupportWidget } from "@neylonai/sdk/react";

<SupportWidget
  config={{
    apiKey: process.env.NEXT_PUBLIC_NEYLONAI_API_KEY,
    // optional: user, pagePath from your existing auth/router
  }}
/>
```

The SDK talks to the Neylon HTTP API only. It has no private `@neylonai/*` runtime dependencies.
