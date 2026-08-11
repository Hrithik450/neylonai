import { tryGetAuthHeaders } from "./runtime-config";
import { apiUrl } from "./network";

/**
 * Fire-and-forget product analytics via Neylon AI → Evently.
 * Never throws; chatbot must not depend on analytics availability.
 */
export function trackAnalytics(
  event: string,
  props?: {
    pagePath?: string | null;
    suggestionId?: string | null;
    agentId?: string | null;
    integrationId?: string | null;
    sessionId?: string | null;
    visitorId?: string | null;
    properties?: Record<string, string | number | boolean | null>;
  },
): void {
  try {
    const auth = tryGetAuthHeaders();
    if ("error" in auth) return;
    void fetch(apiUrl("/api/v1/analytics/events"), {
      method: "POST",
      headers: { ...auth.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ event, ...props }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // ignore
  }
}
