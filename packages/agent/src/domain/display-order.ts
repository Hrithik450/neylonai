/** Dashboard order: Main Agent first, then others by name. */
export function sortAgentsForDisplay<
  T extends { id: string; role?: string | null; name?: string | null },
>(agents: T[]): T[] {
  return [...agents].sort((a, b) => {
    const aMain = a.role === "main" ? 0 : 1;
    const bMain = b.role === "main" ? 0 : 1;
    if (aMain !== bMain) return aMain - bMain;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });
}
