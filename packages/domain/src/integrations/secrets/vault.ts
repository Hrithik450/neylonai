import { and, eq } from "drizzle-orm";
import {
  db,
  organizationIntegrationSecrets,
  organizationIntegrations,
} from "@neylonai/database";
import { decryptSecret, encryptSecret } from "./crypto";

export type PutSecretInput = {
  organizationId: string;
  organizationIntegrationId: string;
  secretKey: string;
  plaintext: string;
};

/**
 * Encrypt and upsert a credential for an org integration.
 */
export async function putSecret(input: PutSecretInput): Promise<void> {
  const key = input.secretKey.trim();
  if (!key) throw new Error("secretKey is required");
  const plaintext = input.plaintext;
  if (!plaintext) throw new Error("plaintext secret is required");

  const blob = encryptSecret(plaintext);
  const now = new Date();

  await db
    .insert(organizationIntegrationSecrets)
    .values({
      organization_id: input.organizationId,
      organization_integration_id: input.organizationIntegrationId,
      secret_key: key,
      ciphertext: blob.ciphertext,
      iv: blob.iv,
      auth_tag: blob.authTag,
      key_version: blob.keyVersion,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: [
        organizationIntegrationSecrets.organization_integration_id,
        organizationIntegrationSecrets.secret_key,
      ],
      set: {
        ciphertext: blob.ciphertext,
        iv: blob.iv,
        auth_tag: blob.authTag,
        key_version: blob.keyVersion,
        updated_at: now,
      },
    });
}

export async function getSecret(input: {
  organizationIntegrationId: string;
  secretKey: string;
}): Promise<string | null> {
  const [row] = await db
    .select({
      ciphertext: organizationIntegrationSecrets.ciphertext,
      iv: organizationIntegrationSecrets.iv,
      authTag: organizationIntegrationSecrets.auth_tag,
    })
    .from(organizationIntegrationSecrets)
    .where(
      and(
        eq(
          organizationIntegrationSecrets.organization_integration_id,
          input.organizationIntegrationId,
        ),
        eq(organizationIntegrationSecrets.secret_key, input.secretKey),
      ),
    )
    .limit(1);

  if (!row) return null;
  return decryptSecret({
    ciphertext: row.ciphertext,
    iv: row.iv,
    authTag: row.authTag,
  });
}

export async function hasSecret(input: {
  organizationIntegrationId: string;
  secretKey: string;
}): Promise<boolean> {
  const [row] = await db
    .select({ id: organizationIntegrationSecrets.id })
    .from(organizationIntegrationSecrets)
    .where(
      and(
        eq(
          organizationIntegrationSecrets.organization_integration_id,
          input.organizationIntegrationId,
        ),
        eq(organizationIntegrationSecrets.secret_key, input.secretKey),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** True if any of the given credential keys exist in the vault. */
export async function hasAnySecret(input: {
  organizationIntegrationId: string;
  secretKeys: readonly string[];
}): Promise<boolean> {
  if (input.secretKeys.length === 0) return false;
  for (const secretKey of input.secretKeys) {
    if (
      await hasSecret({
        organizationIntegrationId: input.organizationIntegrationId,
        secretKey,
      })
    ) {
      return true;
    }
  }
  return false;
}

export async function deleteSecretsForIntegration(
  organizationIntegrationId: string,
): Promise<void> {
  await db
    .delete(organizationIntegrationSecrets)
    .where(
      eq(
        organizationIntegrationSecrets.organization_integration_id,
        organizationIntegrationId,
      ),
    );
}

export async function deleteSecretsForOrgCatalogIntegration(input: {
  organizationId: string;
  integrationType: string;
}): Promise<void> {
  const [row] = await db
    .select({ id: organizationIntegrations.id })
    .from(organizationIntegrations)
    .where(
      and(
        eq(organizationIntegrations.organization_id, input.organizationId),
        eq(organizationIntegrations.integration_type, input.integrationType),
      ),
    )
    .limit(1);
  if (!row) return;
  await deleteSecretsForIntegration(row.id);
}

/**
 * Strip credential keys from a config blob (legacy plaintext cleanup).
 */
export function stripCredentialKeysFromConfig(
  config: Record<string, unknown>,
  credentialKeys: readonly string[],
): Record<string, unknown> {
  if (credentialKeys.length === 0) return { ...config };
  const next = { ...config };
  for (const key of credentialKeys) {
    delete next[key];
  }
  return next;
}
