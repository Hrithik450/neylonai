import "./providers/google";

export type { IdentityProvider, VerifiedIdentity } from "./types";
export { identityProviders } from "./registry";
export { googleIdentityProvider } from "./providers/google";
