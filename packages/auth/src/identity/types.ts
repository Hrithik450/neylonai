export interface VerifiedIdentity {
  googleId: string;
  email: string;
  name: string;
  picture: string;
  emailVerified: boolean;
}

/**
 * Verifies an identity token from an external IdP (Google today).
 * Future IdPs (Apple, Microsoft, …) implement this same contract.
 */
export interface IdentityProvider {
  name: string;
  verifyIdToken(credential: string): Promise<VerifiedIdentity>;
}
