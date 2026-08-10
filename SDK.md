# Neylon AI SDK (`@neylonai/sdk`)

Technical documentation reverse-engineered from the **current** source in
`packages/sdk`. Written for a mid-level developer who needs to understand how
the embeddable chatbot works end-to-end.

**Scope:** how the SDK behaves today.  
**Out of scope:** inventing unpublished APIs or describing planned features as shipped.

---

## 1. Purpose and responsibilities

`@neylonai/sdk` is the **browser-safe** chatbot client and UI for Neylon AI.

It is responsible for:

- Holding the production API origin internally (not client-configurable)
- Authenticating with a **client** API key
- Calling Neylon AI HTTP APIs from the browser
- Parsing the chat event stream
- Rendering the floating widget (launcher, panels, proactive bubbles)
- Local UI state (open/close, threads, input, streaming display)
- Optional visitor analytics beacons to Neylon AI (which may forward to Evently)

It is **not** responsible for:

- LLM / LangGraph execution (`@neylonai/agent` on the server)
- Database, pgvector, Redis (`@neylonai/database`)
- Billing entitlements enforcement (`@neylonai/domain` on the server)
- Storing Gemini keys, payment secrets, or webhook signing secrets
- Customer authentication / session management (reuse the host app’s auth when available)

### Customer integration (quick)

- **Anonymous works out of the box** — only `apiKey` is required.
- **Branding/layout/copy** come from the Neylon dashboard for that API key (loaded automatically). Do not set fonts, colors, logo, or theme in client code.
- **User context is optional** but recommended when the host already has a signed-in user.
- Pass `user: { id, name, email, profile_image? }` from the **existing** auth/session — do not build a Neylon-specific login.
- Pass `pagePath` when available for better proactive / path-aware behavior.
- Never configure a backend URL; the SDK owns it.

```tsx
<SupportWidget config={{ apiKey: "nk_live_…" }} />
```

```
Anonymous visitor → Neylon SDK → works normally
Authenticated user → existing client auth → Neylon SDK + user → personalized
```

For a short install playbook see [`skill.md`](./skill.md).

```
Customer Website
    ↓
Neylon AI SDK (@neylonai/sdk / @neylonai/sdk/react)   ← runs in the browser
    ↓
Neylon AI API (apps/web routes)                  ← server
    ↓
Authentication (client API key)
    ↓
@neylonai/agent  →  Knowledge / Integrations / Database
    ↓
Streaming response (<|END_OF_EVENT|> JSON chunks)
    ↓
Neylon AI SDK
    ↓
Chatbot UI
```

---

## 2. Package structure

```
packages/sdk/
  package.json          # name @neylonai/sdk, exports ".", "./react"
  src/
    index.ts            # public headless exports
    client.ts           # re-exports runtime-config + parseEventStream
    runtime-config.ts   # apiKey / auth headers
    network.ts          # production API origin (SDK-owned)
    auth.ts             # Google login / logout / me (cookie session)
    chat.ts             # streamChat()
    threads.ts          # listThreads / listMessages / listRecentMessages
    suggestions.ts      # fetchSuggestions()
    analytics.ts        # trackAnalytics() fire-and-forget
    sounds.ts           # WidgetAudioManager (Web Audio)
    types.ts            # wire DTOs + AgentStreamEvent
    react/
      index.ts          # public React exports
      support-widget.tsx # <SupportWidget />
      config/types.ts   # SupportWidgetConfig
      context/          # WidgetHostProvider
      store/            # Zustand stores
      hooks/            # message handler, smooth stream, navigation
      proactive/        # suggestion bubbles + audio hook
      widget/           # UI shell, tabs, screens
```

---

## 3. Public exports

### `@neylonai/sdk` (`src/index.ts`)

| Export | Role |
|--------|------|
| `configureNeylonai`, `getApiKey`, `getAuthHeaders`, `tryGetAuthHeaders`, `NeylonaiSdkConfigError` | Runtime config / auth headers |
| `parseEventStream`, `isAbortError` | Stream utilities |
| `streamChat` | Chat orchestration client |
| `listThreads`, `listMessages`, `listRecentMessages` | Thread history |
| `fetchSuggestions` | Proactive suggestion pool |
| `trackAnalytics` | Product analytics beacon |
| `widgetAudioManager`, `WidgetAudioManager`, `SUGGESTION_POP_SOUND_PATH` | Suggestion pop sound |
| Types: `User`, `Thread`, `ThreadMessage`, `AgentStreamEvent`, … | Wire types |

### `@neylonai/sdk/react` (`src/react/index.ts`)

| Export | Role |
|--------|------|
| `SupportWidget` | Embeddable chatbot |
| `useSupportWidget` | Imperative open/close/navigate helpers |
| `WidgetHostProvider`, `useWidgetHost` | Config context |
| Config types | `SupportWidgetConfig` (apiKey / user / pagePath), `StoredWidgetConfig` (dashboard appearance) |
| Selected stores / hooks / `WidgetHome` | Advanced composition |

`package.json` exports map directly to TypeScript source (no `dist/` build artifact in current scripts).

---

## 4. React integration and `<SupportWidget />`

`SupportWidget` (`support-widget.tsx`):

1. On mount / when `apiKey` changes → `configureNeylonai({ apiKey })`
2. Optionally opens via `config.defaultOpen`
3. Fires `widget_impression` analytics (dynamic import; never blocks UI)
4. Wraps children in `WidgetHostProvider` (merges branding/layout/messages/proactive defaults)
5. Renders launcher + `Widget` shell + proactive bubble

```tsx
import { SupportWidget } from "@neylonai/sdk/react";

// Anonymous — apiKey only (branding loads from dashboard)
<SupportWidget
  config={{
    apiKey: process.env.NEXT_PUBLIC_NEYLONAI_API_KEY ?? null,
  }}
  onError={(msg) => console.error(msg)}
/>

// Optional: page path + existing auth user
<SupportWidget
  config={{
    apiKey: process.env.NEXT_PUBLIC_NEYLONAI_API_KEY ?? null,
    pagePath: "/docs",
    user: currentUser
      ? {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          profile_image: currentUser.image,
        }
      : null,
  }}
/>
```

Presentation modes:

- `fixed` (default) — `position: fixed` site embed  
- `inline` — relative layout for framed / in-page hosts  

---

## 5. Browser / client architecture

Everything under `packages/sdk` is intended to run in the **customer’s browser**
(or the Neylon AI marketing site browser). React entry files are marked `"use client"`.

Browser concerns owned by the SDK:

- Fetch + ReadableStream consumption
- Zustand UI state
- `localStorage` for proactive rotation + sound mute preference
- Web Audio API for suggestion pops
- Markdown rendering (`react-markdown` + remark plugins)

The SDK **must not** import `@neylonai/agent`, `@neylonai/database`, Drizzle, Redis,
or server-only secrets (enforced by package boundaries / architecture rules).

---

## 6. API client architecture

Headless client modules call `apiUrl()` (SDK-owned production origin in `network.ts`) plus `tryGetAuthHeaders()` / `getAuthHeaders()`.

- Missing key → soft failure objects or yielded `{ event: "error" }` (chat), not an uncaught throw in `streamChat`’s happy path setup.
- Hard throw: `getAuthHeaders()` → `NeylonaiSdkConfigError`.

`client.ts` also owns `parseEventStream`, shared by chat (and reusable for other delimited streams).

---

## 7. Authentication / API-key flow

```
config.apiKey  ──┐
configureNeylonai ─┼─► configuredApiKey
NEXT_PUBLIC_NEYLONAI_API_KEY ─┘

getAuthHeaders()
  → Authorization: Bearer <key>
  → X-Neylonai-Api-Key: <key>
```

Neylon AI server (`requireApiKeyAuth`) extracts the key from headers, validates
hash/subscription/origin allowlist via `@neylonai/domain` billing helpers.

**Client keys are public-by-design** (embedded in the page). Security relies on:

- Key revocation
- Origin allowlists
- Server-side rate limits / entitlements
- Never embedding *server* secrets in the SDK

Cookie session helpers (`auth.ts`) use `credentials: "include"` against
`/api/v1/google-login/`, `/api/v1/logout/`, `/api/v1/me/` — separate from API-key
orchestration auth.

---

## 8. Configuration flow

1. Host passes runtime `SupportWidgetConfig` (`apiKey`, optional `user` / `pagePath`)
2. `SupportWidget` configures the API key and fetches dashboard appearance for that key
3. `WidgetHostProvider` merges appearance with defaults
4. Downstream hooks read `useWidgetHost().config`

Path visibility (`website.visiblePathPrefixes` / `hiddenPathPrefixes`) comes from
dashboard config and is enforced inside `SupportWidget`.

---

## 9. Widget rendering flow

```
SupportWidget
  └─ WidgetHostProvider
       └─ SupportWidgetInner
            ├─ Widget (panel when open)
            ├─ LauncherSuggestionBubble (proactive)
            └─ Launcher Button (data-testid=ask-ai-launcher)
```

Tabs/screens live under `react/widget/` (home, threads, settings, contact, messages).
UI primitives for the widget live inside `@neylonai/sdk` (`src/ui`). The SDK does **not** depend on `@neylonai/ui` or other private packages.

---

## 10. State management

Zustand stores (browser memory):

| Store | Concerns |
|-------|----------|
| `useWidgetToggleStore` | `isOpen`, collapse |
| `useWidgetStore` | streaming flags, typing, thinking tips/phase |
| `useWidgetNavigationStore` | tab / screen navigation |
| `useThreadStore` | current thread id, thread list |
| `useThreadMessageStore` | in-panel messages |
| `useInputStore` | composer text / disable |

Proactive persistence: `localStorage` key `neylonai.proactiveSuggestions.v5`  
Sound mute: `neylonai.widgetSound.enabled`

---

## 11. Conversation / thread flow

1. User sends text via `useWidgetMessageHandler` → `sendMessage`  
2. Optimistic user message appended locally  
3. `streamChat({ input, senderId: user?.id, threadId, signal })`  
4. Server may emit `threadCreated` → SDK stores thread id  
5. Later turns reuse `currentThreadId`  
6. History APIs (`listThreads` / `listMessages`) support the messages tab when a user id exists  

Anonymous visitors can chat without `user`; thread continuity depends on returned
`threadCreated` and in-memory store for the session.

---

## 12. Message sending flow

```
Input submit
  → abort any prior stream
  → AbortController for this turn
  → append user message (local)
  → disable input / show typing
  → for await (streamChat(...))
       threadCreated | thinkingPhase | thinkingTips
       | assistantResponse | fileUrls | done | error
  → smooth writer paints assistant tokens
  → reset UI
```

Stop button / unmount → `abort()` + dispose writer; abort is **not** treated as a user-facing error (`isAbortError`).

---

## 13. Streaming architecture

Server (`apps/web/.../orchestration/api/v1/chat`):

- Authenticates API key  
- Checks conversation entitlement  
- Calls `streamConversation` from `@neylonai/agent`  
- Writes chunks ending with `<|END_OF_EVENT|>`

Client:

- `streamChat` fetches POST body stream  
- `parseEventStream` splits on `<|END_OF_EVENT|>`, `JSON.parse`s each part  
- `assistantResponse` strings go through `flushStreamToken` then `createSmoothStreamWriter` (rAF, ~42 chars/sec, max 2 chars/frame) for calm display  

This is **not** browser `EventSource` / SSE framing.

---

## 14. Abort / cancellation

- Each send creates an `AbortController`  
- Passed to `fetch` and `parseEventStream`  
- Abort cancels the reader (`reader.cancel`)  
- Stale stream generations ignored via `streamIdRef`  
- `stopStreaming` increments stream id, aborts, flushes/disposes writer  

---

## 15. Event-stream parsing

Delimiter constant: `"<|END_OF_EVENT|>"` (`client.ts`).

`AgentStreamEvent` variants (`types.ts`):

- `threadCreated`  
- `assistantResponse` (string token/chunk)  
- `thinkingPhase`  
- `thinkingTips`  
- `fileUrls`  
- `done`  
- `error`  

Incomplete trailing buffer stays in `leftover` until the next chunk or end.

---

## 16. Proactive suggestions

`useProactiveSuggestions`:

- Pauses when widget open, streaming, or tab hidden  
- Fetches pool via `POST /orchestration/api/v1/suggestions` with `pagePath`, recent messages, mode `idle` | `post_chat`  
- Rotates display-only bubbles above the launcher  
- Persists shown ids / pool in `localStorage`  

Suggestion DTOs include `source`: `welcome | conversation | history | page | knowledge`.

**Knowledge** here means the **server** may use knowledge when building suggestions;
the SDK does not call knowledge/ingestion APIs directly.

---

## 17. Widget audio

`WidgetAudioManager` (`sounds.ts`):

- Loads `Neylon AI backend `/sounds/pop.mp3`` (Neylon AI host must serve `apps/web/public/sounds/pop.mp3`)  
- Web Audio buffer playback after `unlock()` on user gesture  
- Respects `prefers-reduced-motion` and mute preference  
- Dedupes plays by suggestion id  

`useWidgetAudio` ties pops to visible proactive suggestions.

---

## 18. Knowledge-related communication

From the SDK’s perspective:

- Chat and suggestions hit orchestration endpoints  
- Those server routes may retrieve org-scoped knowledge via agent tools / integrations  
- The SDK does **not** expose upload/crawl/index APIs  

Dashboard Knowledge configuration is a separate product surface (`/dashboard/widget`), not part of the browser SDK package.

---

## 19. Error handling

| Layer | Behavior |
|-------|----------|
| Missing API key | `tryGetAuthHeaders` error string; chat yields `error` event |
| Network failure | Generic “unexpected error” yield (unless abort) |
| HTTP error body | Uses `error` field; special-case status **402** subscription message |
| Stream `error` event | `onError(message)` from widget props |
| Analytics | Swallowed entirely |
| Audio | Never throws into UI |

---

## 20. API endpoints called by the SDK

| Method | Path | Module |
|--------|------|--------|
| POST | `/orchestration/api/v1/chat` | `chat.ts` |
| POST | `/orchestration/api/v1/suggestions` | `suggestions.ts` |
| GET | `/api/v1/threads/user/:userId/` | `threads.ts` |
| GET | `/api/v1/thread_messages/:threadId/` | `threads.ts` |
| GET | `/api/v1/thread_messages/recent/:threadId/` | `threads.ts` |
| POST | `/api/v1/analytics/events` | `analytics.ts` |
| POST | `/api/v1/google-login/` | `auth.ts` |
| POST | `/api/v1/logout/` | `auth.ts` |
| GET | `/api/v1/me/` | `auth.ts` |

Optional host (not inside SDK package, but used by Neylon AI’s own site host):

| GET | `/api/v1/widget-config/public` | dashboard-published widget config |

Static asset: `GET Neylon AI backend `/sounds/pop.mp3``

---

## 21–22. Request / response and data passed browser → API

**Chat request JSON:** `{ input, senderId?, threadId? }`  
**Headers:** Bearer + `X-Neylonai-Api-Key`  
**Response:** streaming text body of JSON events + delimiter  

**Suggestions request JSON:** `{ pagePath, recentMessages, mode, limit }`  
**Response JSON:** `{ success, data: ProactiveSuggestionDto[], error? }`  

No Gemini prompts, embeddings, or DB credentials leave the browser via the SDK —
only visitor/page/chat metadata needed for UX.

---

## 23. What runs in the customer’s browser

- `@neylonai/sdk` + `@neylonai/sdk/react`  
- Widget UI primitives bundled under `packages/sdk/src/ui`  
- React 19, Zustand, markdown, lucide icons  
- Client API key (public)  
- Local message list / open state / proactive cache  

---

## 24. What must remain server-side

- API key verification, origin checks, rate limits  
- Plan entitlements / usage metering  
- `@neylonai/agent` graph, model calls, tools  
- Knowledge embeddings / search (`@neylonai/database`, `@neylonai/integrations`)  
- CRM / Slack / Evently secrets  
- Payment providers  

---

## 25. Dependencies and why they exist

From `packages/sdk/package.json`:

| Dependency | Why |
|------------|-----|
| `@neylonai/sdk` | Public SupportWidget + browser API client (publishable) |
| `zustand` | Lightweight client stores |
| `lucide-react` | Launcher / UI icons |
| `react-markdown`, `remark-gfm`, `remark-breaks` | Assistant markdown rendering |
| `react` / `react-dom` ^19 (peers) | Widget is React |

**Not** dependencies of the SDK: `@neylonai/agent`, `@neylonai/database`,
`@neylonai/integrations`, `@neylonai/domain` — those belong on the Neylon AI server.

---

## 26. Build / package / export structure

```json
"exports": {
  ".": "./src/index.ts",
  "./react": "./src/react/index.ts"
}
```

- `"private": true` — workspace package in this monorepo  
- `"build": "tsc --noEmit"` — typecheck only; **no emit/publish pipeline in-repo today**  
- Consumers typically transpile the TypeScript source via the monorepo bundler (Next.js)  

**Planned / unavailable:** public npm semver release with prebuilt `dist/` — do not assume it exists unless your deployment publishes one.

---

## 27–28. Security considerations and API-key handling

- Treat `nk_live_…` as a **publishable client credential** with abuse controls, not a root secret  
- Prefer env: `NEXT_PUBLIC_NEYLONAI_API_KEY` (actual SDK fallback name)  
- Map customer-provided `NEYLONAI_API_KEY` into that env or into `config.apiKey` — never commit the value  
- Restrict keys with allowed origins when embedding on third-party sites  
- Rotate/revoke compromised keys in the dashboard  
- Keep Gemini, DB, Redis, Stripe/Razorpay, Evently, webhook secrets **off** the client  

---

## 29. Installation methods

| Method | Status |
|--------|--------|
| pnpm workspace dependency on `@neylonai/sdk` | **Supported** (this monorepo) |
| `file:` / git path to `packages/sdk` | **Supported** for external apps that can reach the source |
| Public npm `npm install @neylonai/sdk` | Intended publishable package (`private: false`); registry publish is a separate release step |

Also install React 19 peers.

See [`skill.md`](./skill.md) for agent-executable integration steps.

---

## 30. Complete end-to-end request lifecycle

```
1. Page loads → SupportWidget mounts
2. configureNeylonai({ apiKey })
3. trackAnalytics("widget_impression")           [optional, best-effort]
4. User clicks launcher → panel opens
5. User sends "What is your pricing?"
6. SDK POST /orchestration/api/v1/chat
     headers: Bearer + X-Neylonai-Api-Key
     body: { input, senderId?, threadId? }
7. Neylon AI API authenticates key → org + plan
8. Entitlement check (conversation quota)
9. @neylonai/agent streamConversation(...)
     may call knowledge search / tools / integrations (server-only)
10. API writes JSON events + <|END_OF_EVENT|>
11. SDK parseEventStream yields events
12. Smooth writer updates assistant bubble
13. done → input re-enabled
14. On close, proactive may fetch suggestions later
```

ASCII summary:

```
[Browser: @neylonai/sdk/react]
        |  HTTPS + API key
        v
[Neylon AI API: apps/web]
        |  org context
        v
[@neylonai/agent] -----> [@neylonai/integrations] -----> models / Evently / CRM adapters
        |
        +------------> [@neylonai/database] ----------> Postgres / pgvector / Redis
        |
        v
   streamed events
        |
        v
[Browser UI updates]
```

---

## Package relationship map

```
@neylonai/sdk          Public browser SDK (SupportWidget + API client)
@neylonai/sdk/react    Widget UI (owned by SDK; no private package deps)
@neylonai/ui           Private first-party app UI (dashboard/admin) — not used by SDK
@neylonai/agent        Server agent runtime (NOT imported by SDK)
@neylonai/integrations Server adapters (Gemini, web-search, Evently, …)
@neylonai/database     Server persistence / vector search
@neylonai/domain       Private billing / entitlements / org logic
Neylon AI API           Next.js routes in apps/web that glue auth → agent → DB
```

Dependency rule of thumb: **arrows point toward the browser-safe edge**.
`apps/web` may import SDK; SDK must not import agent/database/domain server modules.

---

## Realistic installation example (Next.js)

Matches the real public API (no invented props):

```tsx
// components/support-chatbot.tsx
"use client";

import { SupportWidget } from "@neylonai/sdk/react";
import { usePathname } from "next/navigation";

export function SupportChatbot({
  currentUser,
}: {
  currentUser?: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
}) {
  const pathname = usePathname();

  return (
    <SupportWidget
      config={{
        apiKey: process.env.NEXT_PUBLIC_NEYLONAI_API_KEY ?? null,
        pagePath: pathname,
        // Omit or null when logged out — anonymous still works.
        user: currentUser
          ? {
              id: currentUser.id,
              name: currentUser.name,
              email: currentUser.email,
              profile_image: currentUser.image,
            }
          : null,
      }}
    />
  );
}
```

```bash
# .env.local (gitignored) — customer pastes real values
NEXT_PUBLIC_NEYLONAI_API_KEY=nk_live_REPLACE_ME
```

Anonymous visitors need only the API key. Pass `user` from the host’s existing
auth when available — do not create a Neylon-specific login. This mirrors
`apps/web`’s `SupportWidgetHost`, simplified for an external site.

---

## Related docs

- [`skill.md`](./skill.md) — coding-agent integration playbook  
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — monorepo boundaries  
- [`README.md`](./README.md) — product overview  
