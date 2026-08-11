import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_VERSION = 1;

export class IntegrationSecretsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationSecretsError";
  }
}

function isProductionLike(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1" ||
    Boolean(process.env.VERCEL_ENV)
  );
}

/**
 * Resolve the AES-256 master key.
 * Prefer INTEGRATION_SECRETS_MASTER_KEY (64 hex chars).
 * Local/dev may derive from AUTH_SECRET when the dedicated key is unset.
 */
export function resolveIntegrationSecretsMasterKey(): Buffer {
  const raw = process.env.INTEGRATION_SECRETS_MASTER_KEY?.trim();
  if (raw) {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      return Buffer.from(raw, "hex");
    }
    // Allow base64 32-byte keys
    try {
      const buf = Buffer.from(raw, "base64");
      if (buf.length === 32) return buf;
    } catch {
      /* fall through */
    }
    throw new IntegrationSecretsError(
      "INTEGRATION_SECRETS_MASTER_KEY must be 64 hex characters (32 bytes) or base64 of 32 bytes.",
    );
  }

  if (isProductionLike()) {
    throw new IntegrationSecretsError(
      "INTEGRATION_SECRETS_MASTER_KEY is required in production.",
    );
  }

  const auth = process.env.AUTH_SECRET?.trim();
  if (auth && auth.length >= 16) {
    return createHash("sha256")
      .update(`neylon-integration-secrets:v1:${auth}`)
      .digest();
  }

  throw new IntegrationSecretsError(
    "Set INTEGRATION_SECRETS_MASTER_KEY (64 hex chars) or AUTH_SECRET for local vault encryption.",
  );
}

export type EncryptedSecretBlob = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
};

export function encryptSecret(plaintext: string): EncryptedSecretBlob {
  const key = resolveIntegrationSecretsMasterKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    keyVersion: KEY_VERSION,
  };
}

export function decryptSecret(blob: {
  ciphertext: string;
  iv: string;
  authTag: string;
}): string {
  const key = resolveIntegrationSecretsMasterKey();
  const decipher = createDecipheriv(
    ALGO,
    key,
    Buffer.from(blob.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(blob.authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
