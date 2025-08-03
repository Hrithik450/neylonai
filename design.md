# Hruthik M

Follow these design principles consistently.

• Prioritize information over decoration.
• Use semantic HTML (<article>, <section>, <header>, <footer>) wherever applicable.
• Follow a strict typography hierarchy using design tokens (text-h2, text-h3, text-h4, text-body-lg).
• Every section follows:
Heading
Supporting paragraph
Interactive/visual block
Summary or CTA.
• Use consistent spacing: - Major section: mt-12 - Major content block: mt-8 - Minor spacing: mt-4 - Prefer gap utilities over margins.
• Every information block should be represented as a rounded-xl card with:
bg-card
border border-border-light
• Use accent colors only for highlights, icons, metrics, badges, and CTAs.
• Body content should use text-secondary.
• Important statements should use text-primary font-medium.
• Never invent arbitrary font sizes; use existing typography tokens.
• Prefer data-driven rendering using arrays and map() over duplicated JSX.
• Animations should be subtle (opacity, translate, scale, border-color). Avoid excessive motion.
• Every major component should end with a centered primary CTA.
• Maintain generous whitespace and avoid visual clutter.
• Components should feel premium, editorial, minimal, and engineering-focused rather than flashy or marketing-heavy.

## Brand

- Product/brand: Hruthik M
- URL: https://www.mhrithik.com/
- Audience: developers and technical teams

## Style Foundations

- Visual style: structured, tokenized, content-first
- Main font style: `font.family.primary=Guminert`, `font.family.stack=Guminert, serif`, `font.size.base=16px`, `font.weight.base=400`, `font.lineHeight.base=27.2px`
- Typography scale: `font.size.xs=12px`, `font.size.sm=12.8px`, `font.size.md=14px`, `font.size.lg=16px`, `font.size.xl=18px`, `font.size.2xl=29.4px`, `font.size.3xl=44.1px`, `font.size.4xl=72px`
- Color palette: `color.text.primary=#1c1917`, `color.text.secondary=#57534e`, `color.border.strong=#78716c`, `color.text.inverse=#ea580c`, `color.surface.base=#000000`, `color.surface.muted=#ffffff`, `color.surface.raised=#fcfaf7`, `color.surface.strong=#f6f1ea`
- Spacing scale: `space.1=2px`, `space.2=4px`, `space.3=8px`, `space.4=10px`, `space.5=12px`, `space.6=14px`, `space.7=16px`, `space.8=20px`
- Radius/shadow/motion tokens: `radius.xs=6px`, `radius.sm=12px`, `radius.md=16px`, `radius.lg=40px`, `radius.xl=16777200px` | `shadow.1=rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 1px 3px 0px, rgba(0, 0, 0, 0.1) 0px 1px 2px -1px`, `shadow.2=rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px`, `shadow.3=rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, oklab(0.216114 0.00343135 0.00508514 / 0.1) 0px 10px 15px -3px, oklab(0.216114 0.00343135 0.00508514 / 0.1) 0px 4px 6px -4px`, `shadow.4=rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px` | `motion.duration.instant=150ms`, `motion.duration.fast=200ms`, `motion.duration.normal=300ms`

## Accessibility

- Target: WCAG 2.2 AA
- Keyboard-first interactions required.
- Focus-visible rules required.
- Contrast constraints required.

## Writing Tone

Concise, confident, implementation-focused.

## Rules: Do

- Use semantic tokens, not raw hex values, in component guidance.
- Every component must define states for default, hover, focus-visible, active, disabled, loading, and error.
- Component behavior should specify responsive and edge-case handling.
- Interactive components must document keyboard, pointer, and touch behavior.
- Accessibility acceptance criteria must be testable in implementation.

## Rules: Don't

- Do not allow low-contrast text or hidden focus indicators.
- Do not introduce one-off spacing or typography exceptions.
- Do not use ambiguous labels or non-descriptive actions.
- Do not ship component guidance without explicit state rules.

## Guideline Authoring Workflow

1. Restate design intent in one sentence.
2. Define foundations and semantic tokens.
3. Define component anatomy, variants, interactions, and state behavior.
4. Add accessibility acceptance criteria with pass/fail checks.
5. Add anti-patterns, migration notes, and edge-case handling.
6. End with a QA checklist.

## Required Output Structure

- Context and goals.
- Design tokens and foundations.
- Component-level rules (anatomy, variants, states, responsive behavior).
- Accessibility requirements and testable acceptance criteria.
- Content and tone standards with examples.
- Anti-patterns and prohibited implementations.
- QA checklist.

## Component Rule Expectations

- Include keyboard, pointer, and touch behavior.
- Include spacing and typography token requirements.
- Include long-content, overflow, and empty-state handling.
- Include known page component density: links (20), cards (14), navigation (3), buttons (2), lists (2).

- Extraction diagnostics: Audience and product surface inference confidence is low; verify generated brand context.

## Quality Gates

- Every non-negotiable rule must use "must".
- Every recommendation should use "should".
- Every accessibility rule must be testable in implementation.
- Teams should prefer system consistency over local visual exceptions.

## Animations

Use animations to enhance perceived quality, not to attract attention.

Guidelines:
• Prefer Motion library for animations.
• Keep animations subtle, smooth, and purposeful.
• Use opacity, translateY (8–20px), scale (0.98 → 1), blur, and staggered reveals.
• Animate sections only when they enter the viewport (`whileInView`, `viewport={{ once: true }}`).
• Add gentle hover interactions on cards (slight lift, border color transition, subtle shadow, scale ≤ 1.02).
• Buttons should have smooth hover/tap feedback, never exaggerated effects.
• Use shared layout animations for tabs, accordions, and active indicators.
• Fade and slide content when switching tabs instead of instantly replacing it.
• Animate numbers, progress bars, and metrics only if they improve comprehension.
• Use easing such as `easeOut` with durations between 0.3–0.6s.
• Avoid bounce, spin, large rotations, excessive parallax, long animations, or distracting loops.
• Decorative background elements may have very slow floating or gradient animations only if they remain unobtrusive.
• Every animation should feel premium, polished, and intentional, similar to Linear, Vercel, Stripe, Apple, or OpenAI—not flashy landing pages.
• Performance is a priority: use transform and opacity, avoid layout thrashing, and respect `prefers-reduced-motion`.
