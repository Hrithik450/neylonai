/**
 * A tiny named-provider registry. Each integration category (web-search,
 * notifications, …) gets its own registry instance so a new plugin can
 * register itself under a name and be looked up by consumers without anyone
 * editing this file. First-party knowledge search lives in `@neylonai/agent`.
 */
export function createRegistry<TProvider>() {
  const providers = new Map<string, TProvider>();
  let defaultName: string | null = null;

  return {
    /** Registers a provider under `name`. The first registered provider becomes the default. */
    register(name: string, provider: TProvider): void {
      providers.set(name, provider);
      if (defaultName === null) defaultName = name;
    },
    get(name: string): TProvider | undefined {
      return providers.get(name);
    },
    getDefault(): TProvider | undefined {
      return defaultName ? providers.get(defaultName) : undefined;
    },
    setDefault(name: string): void {
      defaultName = name;
    },
    list(): string[] {
      return Array.from(providers.keys());
    },
  };
}
