# 04 — Customization (making it easy for clients)

_Answers: "how do they provide customization for clients easily, and how do we simplify?" The surprising finding: Neylon's customization engine is already rich — the problem is that most of it is **unreachable** by the non-technical clients you're now targeting._

## The finding: powerful config, half of it hidden

`StoredWidgetConfig` (`packages/sdk/src/widget-config.ts`, with `DEFAULT_WIDGET_CONFIG`) already supports a deep customization surface across six groups:

| Group | Fields (abridged) |
|---|---|
| **branding** | name, logoUrl, primaryTextColor (`#0E3228`), secondaryTextColor, accentColor, tabActiveColor, gradientFrom (`rgb(144,238,144)`)/gradientTo (`#ffffff`), backgrounds, tagline, font |
| **layout** | position, launcherSize, offsetX (24)/offsetY (12), launcherVisible |
| **messages** | welcomeGreeting (`Hi {name} 👋`), introMessages, inputPlaceholder, **suggestedQuestions**, askTitle/Subtitle, feedbackTitle (`Talk to the team`)/Subtitle, faqs (max 4) |
| **features** | homeTab, messagesTab, contactTab (default off), voiceInput |
| **website** | visiblePathPrefixes, hiddenPathPrefixes, autoOpenPathPrefixes |
| **proactive** | enabled, sound, volume (0.22), timing, behavioralTriggers (scrollDepth / dwell / exitIntent) |

Two ways to set it, and **code wins over dashboard**:
- **Dashboard UI** (`widget-config-center.tsx`) — but it exposes **only 4 sections**: Appearance, Behavior, Proactive, Launcher.
- **Code** — `defineWidgetCustomization()` passed into the SDK; overrides the dashboard.

### The gap that hurts no-code clients

These real, useful fields have **no dashboard control** — they can *only* be set in code today:

- `website.visiblePathPrefixes` / `hiddenPathPrefixes` / `autoOpenPathPrefixes` — **page targeting** ("show only on /pricing, auto-open on /demo"). Huge for the proactive/lead use case.
- `features.homeTab` / `messagesTab` / `contactTab` / `voiceInput` — **turn tabs on/off**.
- `messages.suggestedQuestions` — the starter prompts in the empty chat.
- `messages.inputPlaceholder`.
- `proactive.behavioralTriggers` (scrollDepth / dwell / exitIntent) — the *specific* trigger tuning; the dashboard exposes only coarse proactive on/off + timing.

**For the Webflow/no-code client you're now targeting, "code-only" = "impossible."** They'll never open `defineWidgetCustomization()`. So a chunk of your best differentiation (page-targeted proactive engagement) is invisible to exactly the buyer who needs it. This is a second face of the same "too complex" complaint from [`01`](./01-simplify-onboarding.md).

## Design principle: two tiers of customization, one config

Keep the architecture — it's good — and expose it in two lanes:

1. **No-code (dashboard):** every field a marketer/founder needs, with sensible defaults, live preview, and presets. This is the default path.
2. **Code (SDK):** `defineWidgetCustomization()` stays for developers who want per-route logic, dynamic values, or version-controlled config. **Code continues to override dashboard** — that's the right precedence; don't change it.

The public config endpoint (`GET /api/v1/widget-config/public`) already delivers dashboard config to the runtime widget, so surfacing more fields in the dashboard is mostly **UI work + validation**, not new plumbing.

## Recommendations (in priority order)

### 1. Surface the code-only fields in the dashboard  ⭐ highest impact
Add dashboard controls for the hidden fields, grouped so they're understandable to non-devs:
- **Pages** (new section): visible/hidden/auto-open path rules — a simple "show on these pages / hide on these / auto-open on these" UI. Unlocks targeted proactive engagement for no-code users.
- **Tabs & features:** toggles for home/messages/contact tabs + voice input.
- **Starter questions:** edit `suggestedQuestions` + `inputPlaceholder` inline.
- **Proactive triggers:** expose scrollDepth / dwell / exitIntent with friendly labels ("Trigger when a visitor scrolls 60%," "…has been on the page 30s," "…moves to leave").

### 2. Live preview
Render the widget live next to the settings (the dashboard already has a static demo/mock of the widget — `config.staticDemo` path in `widget-messages.tsx`). Let changes reflect instantly. Non-technical users need to *see* it, not imagine hex codes.

### 3. Presets / templates
Ship 3–5 named starting points ("Minimal," "Support-first," "Lead-gen / proactive," "Dark," "Playful") that set a coherent bundle of branding + behavior in one click. Most clients want "make it look good and on-brand," not 20 individual knobs.

### 4. Auto-branding on signup
When you crawl their site for knowledge ([`01`](./01-simplify-onboarding.md)), also **scrape brand basics** — logo, primary color, font — and pre-fill `branding.*`. The widget then looks on-brand before they touch anything. High "wow," low effort given you're already fetching their pages.

### 5. Plan-gated customization (ties to [`03`](./03-pricing-and-differentiation.md))
Use customization depth as a pricing lever, matching what's already gated:
- **Free:** presets + basic colors/logo; "Powered by Neylon" shown.
- **Starter+:** full branding, starter questions, page targeting.
- **Pro+:** advanced proactive triggers (already Pro/Business-gated), remove branding, custom fonts.
Keep it aligned with the existing `advanced_proactive` gate so it's consistent.

## Explicitly keep (don't "simplify" these away)

- **Code override precedence** — developers rely on it; it's your power-user story and a reason technical teams pick you.
- **The full `StoredWidgetConfig` shape** — it's an asset. The task is *exposure*, not reduction.
- **Sensible defaults** (`DEFAULT_WIDGET_CONFIG`) — they're why the widget looks fine with zero config; protect that first-run experience.

## Today → target

| Aspect | Today | Target |
|---|---|---|
| Fields in dashboard | 4 sections | All user-relevant fields, grouped |
| Page targeting | Code only | Dashboard "Pages" section |
| Tab/feature toggles | Code only | Dashboard toggles |
| Proactive triggers | Coarse (on/off + timing) | Friendly per-trigger controls |
| Preview | Static mock | Live, reflects edits instantly |
| Getting on-brand | Manual hex/logo entry | Auto-scraped on signup + presets |
| Developer path | `defineWidgetCustomization()` | Unchanged (still overrides) |

## Decisions for you

1. **Approve surfacing the code-only fields in the dashboard** (Pages, tabs/features, starter questions, proactive triggers)? Which first? (Recommended: **Pages** + starter questions, since they drive the lead/proactive use case.)
2. **Live preview** — build now or fast-follow? (Recommended: now; it's the single biggest "feels easy" upgrade for non-devs.)
3. **Presets/templates** — want them, and roughly which named presets fit your ICP?
4. **Auto-branding scrape on signup** — in scope with the auto-crawl work, or separate?
5. **Plan-gate customization depth** per the tiers above — agree with the split?
6. **Confirm code-override precedence stays** as-is. (Recommended: yes.)
