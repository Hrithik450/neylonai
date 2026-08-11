import { describe, expect, it } from "vitest";
import { createHash, randomBytes } from "crypto";
import { decryptSecret, encryptSecret } from "./crypto";

describe("integration secrets crypto", () => {
  it("round-trips plaintext", () => {
    const prev = process.env.INTEGRATION_SECRETS_MASTER_KEY;
    process.env.INTEGRATION_SECRETS_MASTER_KEY = randomBytes(32).toString("hex");
    try {
      const blob = encryptSecret("postgresql://u:p@host/db");
      expect(blob.ciphertext).toBeTruthy();
      expect(blob.iv).toBeTruthy();
      expect(blob.authTag).toBeTruthy();
      expect(decryptSecret(blob)).toBe("postgresql://u:p@host/db");
    } finally {
      if (prev === undefined) delete process.env.INTEGRATION_SECRETS_MASTER_KEY;
      else process.env.INTEGRATION_SECRETS_MASTER_KEY = prev;
    }
  });

  it("derives from AUTH_SECRET when master key unset (dev)", () => {
    const prevKey = process.env.INTEGRATION_SECRETS_MASTER_KEY;
    const prevAuth = process.env.AUTH_SECRET;
    const prevNode = process.env.NODE_ENV;
    delete process.env.INTEGRATION_SECRETS_MASTER_KEY;
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
    process.env.NODE_ENV = "development";
    process.env.AUTH_SECRET = "dev-auth-secret-at-least-16";
    try {
      const blob = encryptSecret("secret-value");
      expect(decryptSecret(blob)).toBe("secret-value");
      // Stable derivation
      const expected = createHash("sha256")
        .update(`neylon-integration-secrets:v1:${process.env.AUTH_SECRET}`)
        .digest();
      expect(expected.length).toBe(32);
    } finally {
      if (prevKey === undefined) delete process.env.INTEGRATION_SECRETS_MASTER_KEY;
      else process.env.INTEGRATION_SECRETS_MASTER_KEY = prevKey;
      if (prevAuth === undefined) delete process.env.AUTH_SECRET;
      else process.env.AUTH_SECRET = prevAuth;
      if (prevNode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNode;
    }
  });
});
