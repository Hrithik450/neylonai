import { db, schema } from "@neylonai/database";
import { and, eq } from "drizzle-orm";
import type { ParticipantInput, ParticipantRecord } from "./participants.types";

const { organizationParticipants } = schema;

function rowToParticipant(
  row: typeof organizationParticipants.$inferSelect,
): ParticipantRecord {
  return {
    id: row.id,
    organization_id: row.organization_id,
    external_id: row.external_id,
    display_name: row.display_name,
    email: row.email ?? null,
    profile_image: row.profile_image ?? null,
    is_anonymous: row.is_anonymous,
    traits: {},
    last_seen_at: null,
    created_at: row.created_at!.toISOString(),
    updated_at: row.updated_at!.toISOString(),
  };
}

function normalizeExternalId(externalId: string): string | null {
  const trimmed = externalId.trim();
  if (!trimmed || trimmed.length > 255) return null;
  return trimmed;
}

function pickDisplayName(input: ParticipantInput): string {
  const name = input.name?.trim();
  if (name) return name.slice(0, 255);
  if (input.email?.trim()) return input.email.trim().split("@")[0]!.slice(0, 255);
  return "Guest";
}

export class ParticipantsRepository {
  static async findByOrgAndExternalId(
    organizationId: string,
    externalId: string,
  ): Promise<ParticipantRecord | null> {
    const [row] = await db
      .select()
      .from(organizationParticipants)
      .where(
        and(
          eq(organizationParticipants.organization_id, organizationId),
          eq(organizationParticipants.external_id, externalId),
        ),
      )
      .limit(1);
    return row ? rowToParticipant(row) : null;
  }

  static async findById(id: string): Promise<ParticipantRecord | null> {
    const [row] = await db
      .select()
      .from(organizationParticipants)
      .where(eq(organizationParticipants.id, id))
      .limit(1);
    return row ? rowToParticipant(row) : null;
  }

  static async upsertParticipant(
    organizationId: string,
    input: ParticipantInput,
  ): Promise<ParticipantRecord> {
    const externalId = normalizeExternalId(input.externalId);
    if (!externalId) {
      throw new Error("Invalid participant external id");
    }

    const now = new Date();
    const displayName = pickDisplayName(input);
    const email = input.email?.trim().slice(0, 254) || null;
    const profileImage = input.profileImage?.trim() || null;
    const isAnonymous = input.anonymous ?? !email;

    const existing = await ParticipantsRepository.findByOrgAndExternalId(
      organizationId,
      externalId,
    );

    if (existing) {
      const incomingIdentified = Boolean(email) && isAnonymous === false;
      const preserveIdentity = !incomingIdentified && existing.is_anonymous === false;
      const [row] = await db
        .update(organizationParticipants)
        .set({
          display_name: preserveIdentity ? existing.display_name : displayName,
          ...(email ? { email } : {}),
          ...(profileImage ? { profile_image: profileImage } : {}),
          is_anonymous: preserveIdentity ? false : isAnonymous,
          updated_at: now,
        })
        .where(eq(organizationParticipants.id, existing.id))
        .returning();
      return rowToParticipant(row);
    }

    const [row] = await db
      .insert(organizationParticipants)
      .values({
        organization_id: organizationId,
        external_id: externalId,
        display_name: displayName,
        email,
        profile_image: profileImage,
        is_anonymous: isAnonymous,
      })
      .returning();
    return rowToParticipant(row);
  }

  static async identifyParticipant(input: {
    id: string;
    organizationId: string;
    name: string;
    email: string;
  }): Promise<ParticipantRecord | null> {
    const [row] = await db
      .update(organizationParticipants)
      .set({
        display_name: input.name.trim().slice(0, 255),
        email: input.email.trim().toLowerCase().slice(0, 254),
        is_anonymous: false,
        updated_at: new Date(),
      })
      .where(
        and(
          eq(organizationParticipants.id, input.id),
          eq(organizationParticipants.organization_id, input.organizationId),
        ),
      )
      .returning();
    return row ? rowToParticipant(row) : null;
  }

  /**
   * Set only the visitor's display name — used when they hand off with a
   * non-email contact (phone/LinkedIn). Leaves `email` and `is_anonymous`
   * untouched, since there is no email to identify them by.
   */
  static async setDisplayName(input: {
    id: string;
    organizationId: string;
    name: string;
  }): Promise<ParticipantRecord | null> {
    const [row] = await db
      .update(organizationParticipants)
      .set({
        display_name: input.name.trim().slice(0, 255),
        updated_at: new Date(),
      })
      .where(
        and(
          eq(organizationParticipants.id, input.id),
          eq(organizationParticipants.organization_id, input.organizationId),
        ),
      )
      .returning();
    return row ? rowToParticipant(row) : null;
  }

  /** GDPR-style anonymization — preserves threads without PII. */
  static async anonymizeParticipant(id: string): Promise<ParticipantRecord | null> {
    const [row] = await db
      .update(organizationParticipants)
      .set({
        display_name: "Anonymous",
        email: null,
        profile_image: null,
        is_anonymous: true,
        updated_at: new Date(),
      })
      .where(eq(organizationParticipants.id, id))
      .returning();
    return row ? rowToParticipant(row) : null;
  }
}
