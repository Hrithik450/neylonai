export type ContextMessage = { role: string; content: string };

/** Stable fingerprint for the visitor's latest support-widget conversation. */
export function messageContextFingerprint(
  messages: ContextMessage[] | null | undefined,
): string | null {
  if (!messages?.length) return null;
  const tail = messages.slice(-8);
  if (!tail.some((message) => message.role === "user")) return null;
  return tail
    .map((message) => `${message.role}:${message.content.slice(0, 120)}`)
    .join("\n");
}

export function hasUnreadConversationContext(
  messages: ContextMessage[] | null | undefined,
  lastConsumedFingerprint: string | null,
): boolean {
  const fingerprint = messageContextFingerprint(messages);
  if (!fingerprint) return false;
  return fingerprint !== lastConsumedFingerprint;
}
