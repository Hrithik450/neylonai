/**
 * First-party publishable client API key for the landing SupportWidget.
 *
 * Same model as any customer embed: the key in env belongs to your org
 * (Neylon AI). Dashboard publish for that org is what the landing widget loads.
 * No special admin / auto-mint path.
 */
export function getSiteWidgetApiKey(): string | null {
  const key = process.env.NEXT_PUBLIC_NEYLONAI_API_KEY?.trim() || null;
  return key || null;
}
