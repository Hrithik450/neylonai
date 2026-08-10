import { db } from "../postgres/client";
import { organizations } from "../postgres/schema/organizations";
import {
  KNOWLEDGE_EMBEDDING_DIMENSIONS,
  KNOWLEDGE_EMBEDDING_MODEL,
} from "../postgres/schema/knowledge";
import { eq } from "drizzle-orm";

export interface KnowledgeScope {
  organizationId: string;
  organizationSlug: string;
  embeddingModel: string;
  embeddingDimensions: number;
}

function requireOrganizationId(organizationId: string): string {
  const trimmed = organizationId.trim();
  if (!trimmed) {
    throw new Error(
      "organizationId is required to resolve knowledge scope (authenticate the request first)",
    );
  }
  return trimmed;
}

/**
 * Resolve knowledge scope for an already-authenticated organization.
 *
 * Production: Request → authenticate → organizationId → org-scoped search.
 * Never trusts a client-supplied organization slug for authorization.
 * Embedding model/dimensions are shared defaults (no knowledge_bases row).
 */
export async function resolveKnowledgeScope(options: {
  organizationId: string;
}): Promise<KnowledgeScope | null> {
  const organizationId = requireOrganizationId(options.organizationId);

  const [org] = await db
    .select({
      id: organizations.id,
      slug: organizations.slug,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!org) return null;

  return {
    organizationId: org.id,
    organizationSlug: org.slug,
    embeddingModel: KNOWLEDGE_EMBEDDING_MODEL,
    embeddingDimensions: KNOWLEDGE_EMBEDDING_DIMENSIONS,
  };
}

/**
 * Dev / scripts only — resolves org by env slug (`KNOWLEDGE_ORGANIZATION_SLUG`).
 * Never use in production request handlers.
 */
export async function resolveDevKnowledgeScope(options?: {
  organizationSlug?: string;
}): Promise<KnowledgeScope | null> {
  const slug =
    options?.organizationSlug?.trim() ||
    process.env.KNOWLEDGE_ORGANIZATION_SLUG?.trim() ||
    "";
  if (!slug) return null;

  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (!org) return null;
  return resolveKnowledgeScope({ organizationId: org.id });
}
