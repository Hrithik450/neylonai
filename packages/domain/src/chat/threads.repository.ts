import { db, schema } from "@neylonai/database";
import { and, eq, desc } from "drizzle-orm";
import type { Thread, CreateThreadInput, UpdateThreadInput } from "./threads.types";

const { threads, organizationParticipants } = schema;

function rowToThread(
  row: {
    id: string;
    organization_id?: string | null;
    participant_id: string | null;
    title: string;
    escalated?: boolean | null;
    conversation_status?: Thread["conversation_status"] | null;
    created_at: Date | null;
  },
  externalId?: string | null,
): Thread {
  return {
    id: row.id,
    user: externalId ?? "",
    title: row.title,
    escalated: row.escalated === true,
    conversation_status: row.conversation_status ?? "ai_active",
    created_at: row.created_at!.toISOString(),
  };
}

export class ThreadsRepository {
  static async createThread(data: CreateThreadInput): Promise<Thread> {
    const [participant] = await db
      .select({
        external_id: organizationParticipants.external_id,
        organization_id: organizationParticipants.organization_id,
      })
      .from(organizationParticipants)
      .where(eq(organizationParticipants.id, data.participant_id))
      .limit(1);

    if (!participant) {
      throw new Error("Participant not found");
    }
    if (participant.organization_id !== data.organization_id) {
      throw new Error("Participant does not belong to this organization");
    }

    const [row] = await db
      .insert(threads)
      .values({
        organization_id: data.organization_id,
        participant_id: data.participant_id,
        title: data.title,
      })
      .returning();
    return rowToThread(row, participant.external_id);
  }

  static async getThreadById(threadId: string): Promise<Thread | null> {
    const [row] = await db
      .select({
        id: threads.id,
        organization_id: threads.organization_id,
        participant_id: threads.participant_id,
        title: threads.title,
        escalated: threads.escalated,
        conversation_status: threads.conversation_status,
        created_at: threads.created_at,
        external_id: organizationParticipants.external_id,
      })
      .from(threads)
      .leftJoin(
        organizationParticipants,
        eq(threads.participant_id, organizationParticipants.id),
      )
      .where(eq(threads.id, threadId))
      .limit(1);
    if (!row) return null;
    return rowToThread(row, row.external_id);
  }

  static async listThreadsByExternalId(
    organizationId: string,
    externalId: string,
  ): Promise<Thread[]> {
    const rows = await db
      .select({
        id: threads.id,
        organization_id: threads.organization_id,
        participant_id: threads.participant_id,
        title: threads.title,
        escalated: threads.escalated,
        conversation_status: threads.conversation_status,
        created_at: threads.created_at,
        external_id: organizationParticipants.external_id,
      })
      .from(threads)
      .innerJoin(
        organizationParticipants,
        eq(threads.participant_id, organizationParticipants.id),
      )
      .where(
        and(
          eq(threads.organization_id, organizationId),
          eq(organizationParticipants.external_id, externalId),
        ),
      )
      .orderBy(desc(threads.created_at));
    return rows.map((row) => rowToThread(row, row.external_id));
  }

  /**
   * Threads for a participant that belong to the API key's organization.
   * Filters on threads.organization_id (tenant scope).
   */
  static async listThreadsByUserForOrg(
    externalUserId: string,
    organizationId: string,
  ): Promise<Thread[]> {
    const rows = await db
      .select({
        id: threads.id,
        organization_id: threads.organization_id,
        participant_id: threads.participant_id,
        title: threads.title,
        escalated: threads.escalated,
        conversation_status: threads.conversation_status,
        created_at: threads.created_at,
        external_id: organizationParticipants.external_id,
      })
      .from(threads)
      .innerJoin(
        organizationParticipants,
        eq(threads.participant_id, organizationParticipants.id),
      )
      .where(
        and(
          eq(threads.organization_id, organizationId),
          eq(organizationParticipants.external_id, externalUserId),
        ),
      )
      .orderBy(desc(threads.created_at));

    return rows.map((row) => rowToThread(row, row.external_id));
  }

  static async updateThread(
    threadId: string,
    data: UpdateThreadInput,
  ): Promise<Thread | null> {
    const [row] = await db
      .update(threads)
      .set(data)
      .where(eq(threads.id, threadId))
      .returning();
    if (!row) return null;
    const externalId = row.participant_id
      ? await ParticipantsLookup.externalIdByParticipantId(row.participant_id)
      : null;
    return rowToThread(row, externalId);
  }

  static async deleteThread(threadId: string): Promise<boolean> {
    const result = await db
      .delete(threads)
      .where(eq(threads.id, threadId))
      .returning();
    return result.length > 0;
  }
}

class ParticipantsLookup {
  static async externalIdByParticipantId(
    participantId: string,
  ): Promise<string | null> {
    const [row] = await db
      .select({ external_id: organizationParticipants.external_id })
      .from(organizationParticipants)
      .where(eq(organizationParticipants.id, participantId))
      .limit(1);
    return row?.external_id ?? null;
  }
}
