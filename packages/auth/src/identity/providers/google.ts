import { OAuth2Client } from "google-auth-library";
import { identityProviders } from "../registry";
import type { IdentityProvider, VerifiedIdentity } from "../types";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/** Verifies Google One-Tap / Sign-In ID tokens. */
export const googleIdentityProvider: IdentityProvider = {
  name: "google",
  async verifyIdToken(credential: string): Promise<VerifiedIdentity> {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error("Invalid Google ID token payload");
    }

    return {
      googleId: payload.sub!,
      email: payload.email!,
      name: payload.name ?? "",
      picture: payload.picture ?? "",
      emailVerified: !!payload.email_verified,
    };
  },
};

identityProviders.register(googleIdentityProvider.name, googleIdentityProvider);
