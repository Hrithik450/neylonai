export {
  configureNeylonai,
  getApiKey,
  getAuthHeaders,
  tryGetAuthHeaders,
  NeylonaiSdkConfigError,
  type ConfigureNeylonaiOptions,
} from "./runtime-config";

/** True when an error is an abort (fetch or stream reader cancelled). */
export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: string }).name;
  return name === "AbortError";
}

/**
 * Parses a standard SSE response body (`data: <json>\n\n` per event)
 * into typed JSON events. Cancels the reader when `signal` aborts.
 */
export async function* parseEventStream<TEvent>(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<TEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  const onAbort = () => {
    void reader.cancel().catch(() => undefined);
  };

  if (signal) {
    if (signal.aborted) {
      onAbort();
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    signal.addEventListener("abort", onAbort, { once: true });
  }

  try {
    while (true) {
      if (signal?.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError");
      }

      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const block of events) {
        const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
        if (!dataLine) continue;
        const json = dataLine.slice(6).trim();
        if (!json) continue;
        yield JSON.parse(json) as TEvent;
      }
    }
  } finally {
    if (signal) signal.removeEventListener("abort", onAbort);
    try {
      reader.releaseLock();
    } catch {
      // Reader may already be cancelled / released.
    }
  }
}
