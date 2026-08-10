import type { IdentityProvider } from "./types";

function createIdentityRegistry() {
  const providers = new Map<string, IdentityProvider>();
  let defaultName: string | null = null;

  return {
    register(name: string, provider: IdentityProvider): void {
      providers.set(name, provider);
      if (defaultName === null) defaultName = name;
    },
    get(name: string): IdentityProvider | undefined {
      return providers.get(name);
    },
    getDefault(): IdentityProvider | undefined {
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

export const identityProviders = createIdentityRegistry();
