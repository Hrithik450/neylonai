/** Dashboard sidebar order: Support → Booking → Lead → Sales. */
export const AGENT_DISPLAY_ORDER = [
  "neylonai-chatbot",
  "booking",
  "lead",
  "sales",
] as const;

export function sortAgentsForDisplay<T extends { id: string }>(
  agents: T[],
): T[] {
  const rank = new Map<string, number>(
    AGENT_DISPLAY_ORDER.map((id, i) => [id, i]),
  );
  return [...agents].sort(
    (a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99),
  );
}
