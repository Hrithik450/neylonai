/**
 * Soft trailing-fence buffer for streamed markdown.
 *
 * Unlike the old bold holdback (which could stall an entire sentence on an
 * open `**`), this only parks the last 1–2 incomplete fence characters so
 * the rest of the text paints immediately — ChatGPT/Claude behaviour.
 */
export function flushStreamToken(
  pendingBuffer: string,
  token: string,
): { pending: string; ready: string } {
  const next = pendingBuffer + token;
  if (!next) return { pending: "", ready: "" };

  // Hold back a trailing lone `*` that might become `**`, or a trailing `\`.
  const hold =
    next.endsWith("\\") || /(?:^|[^*])\*$/.test(next)
      ? next.slice(-1)
      : "";

  if (!hold) {
    return { pending: "", ready: next };
  }

  return {
    pending: hold,
    ready: next.slice(0, -hold.length),
  };
}
