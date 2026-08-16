/**
 * Resolve which required integrations are not yet enabled for an agent.
 * An agent with no required integrations returns [].
 */
export function getMissingRequiredIntegrations(
  requiredIntegrationIds: readonly string[] | undefined,
  enabledIntegrationIds: ReadonlySet<string> | readonly string[],
): string[] {
  const required = requiredIntegrationIds ?? [];
  if (required.length === 0) return [];
  const enabled =
    enabledIntegrationIds instanceof Set
      ? enabledIntegrationIds
      : new Set(enabledIntegrationIds);
  return required.filter((id) => !enabled.has(id));
}
