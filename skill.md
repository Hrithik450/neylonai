---
name: neylonai-sdk-integration
description: >-
  Integrates Neylon AI SupportWidget (@neylonai/sdk/react) with a publishable
  API key. Anonymous by default; optionally maps existing auth user fields.
  Branding comes from the Neylon dashboard. Use when embedding Neylon AI or
  wiring NEXT_PUBLIC_NEYLONAI_API_KEY.
---

# Neylon AI SDK integration

Embed the widget with a publishable API key. Branding and widget settings come
from the Neylon dashboard automatically — never configure them in code. Do not
set a backend URL; the SDK owns it.

## Rules

1. **`apiKey` is the only required config.** Anonymous visitors work with no user setup.
2. Do **not** configure branding, fonts, colors, logo, layout, or theme in code.
3. Do **not** create Neylon-specific auth, sessions, components-for-branding, or `baseUrl`.
4. Reuse the customer’s existing auth when present; otherwise stay anonymous.
5. Never commit real API keys. Prefer `NEXT_PUBLIC_NEYLONAI_API_KEY` or `config.apiKey` from env.

## Install

```bash
pnpm add @neylonai/sdk   # React 19 peers
# .env.local
NEXT_PUBLIC_NEYLONAI_API_KEY=nk_live_REPLACE_ME
```

Key: Neylon AI → **Settings → Security**. Allowlist the site origin if required.
Until npm publish, use a workspace / `file:` / git dependency on `packages/sdk`.

## Minimal embed

```tsx
import { SupportWidget } from "@neylonai/sdk/react";

<SupportWidget
  config={{
    apiKey: process.env.NEXT_PUBLIC_NEYLONAI_API_KEY,
  }}
/>
```

Mount once in the app shell. Dashboard changes apply on load — no client code changes.

```
Anonymous visitor → Neylon SDK → works normally
```

## Optional: page path

```tsx
pagePath: pathname // or window.location.pathname
```

## Optional: existing auth user

If the app already has a signed-in user, map it. Do not invent Neylon login.

Supported fields: `id`, `name`, `email`, `profile_image` (if available).

```tsx
user: currentUser
  ? {
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      profile_image: currentUser.image ?? undefined,
    }
  : null,
```

```
Authenticated user → existing auth/session → Neylon SDK + user → personalized
```

## Done when

- [ ] Widget works with only `apiKey`
- [ ] No branding / `baseUrl` / Neylon-specific auth in client code
- [ ] Existing auth mapped when available; anonymous when not
- [ ] No real API key committed
