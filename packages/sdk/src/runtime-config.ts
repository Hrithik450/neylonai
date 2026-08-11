/**
 * Runtime configuration for the headless API client / SDK.
 * Embed hosts: configureNeylonai({ apiKey })
 */

let configuredExplicitly = false;
let configuredApiKey: string | null = null;

export type ConfigureNeylonaiOptions = {
  /**
   * Client/public API key (`nk_live_…`). Required for chatbot API calls.
   */
  apiKey?: string | null;
};

export function configureNeylonai(options: ConfigureNeylonaiOptions): void {
  if (options.apiKey !== undefined) {
    configuredExplicitly = true;
    configuredApiKey = options.apiKey?.trim() || null;
  }
}

export function getApiKey(): string | null {
  if (configuredExplicitly) return configuredApiKey;
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_NEYLONAI_API_KEY) {
    const key = process.env.NEXT_PUBLIC_NEYLONAI_API_KEY.trim();
    return key || null;
  }
  return null;
}

export class NeylonaiSdkConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NeylonaiSdkConfigError";
  }
}

/** Headers for authenticated SDK requests. Throws if API key missing. */
export function getAuthHeaders(
  extra?: Record<string, string>,
): Record<string, string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new NeylonaiSdkConfigError(
      "Missing Neylon AI API key. Call configureNeylonai({ apiKey }) or set NEXT_PUBLIC_NEYLONAI_API_KEY.",
    );
  }
  return {
    Authorization: `Bearer ${apiKey}`,
    "X-Neylonai-Api-Key": apiKey,
    ...extra,
  };
}

/** Soft check — returns null headers message for graceful UI failure. */
export function tryGetAuthHeaders(
  extra?: Record<string, string>,
): { headers: Record<string, string> } | { error: string } {
  try {
    return { headers: getAuthHeaders(extra) };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Missing Neylon AI API key.",
    };
  }
}
