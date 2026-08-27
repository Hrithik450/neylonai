/**
 * The widget bundle is served from the app's own origin at /v1/widget.js.
 * Mirrors the SDK's origin resolution (packages/sdk/src/network.ts): honor the
 * NEXT_PUBLIC_NEYLONAI_API_ORIGIN override, otherwise the production origin.
 * NEXT_PUBLIC_ vars are inlined at build time, so this is safe on client too.
 */
export const WIDGET_SCRIPT_SRC = `${
  process.env.NEXT_PUBLIC_NEYLONAI_API_ORIGIN?.replace(/\/$/, "") ||
  "https://neylonai.mhrithik.com"
}/v1/widget.js`;

/** The full one-line install snippet for a given publishable key. */
export function buildWidgetSnippet(key: string): string {
  return `<script src="${WIDGET_SCRIPT_SRC}" data-key="${key}" async></script>`;
}
