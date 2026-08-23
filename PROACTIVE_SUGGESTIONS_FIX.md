# Superseded

The section-queue / `visitor_suggestion_state` plan in this file was never
shipped in that form. Proactive delivery is now documented in
[`PROACTIVE_SUGGESTIONS.md`](./PROACTIVE_SUGGESTIONS.md) — pacing, the
per-session cap, on-demand bubbles after a support-widget interaction, and how
candidate text is generated.

Still open from the original plan:

- Run a full website crawl refresh for org `8da298a2-bd3d-4795-a472-779bdeee8c88`
  (`https://neylonai.mhrithik.com`) so every page has crawled section
  suggestions. Model-written candidates now cover the gap, but crawled
  per-section suggestions still rank above them for page-specific bubbles.
