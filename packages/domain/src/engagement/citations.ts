import { createHash } from "node:crypto";
import type { ProvenanceChunkHit } from "../knowledge/provenance";

export type DashboardCitation = {
  chunkId: string;
  documentId: string;
  sourceId: string | null;
  documentName: string | null;
  sourceLabel: string | null;
  sourceType: string | null;
  score: number | null;
  rank: number;
};

/** Citation persistence was removed with message_citations. */
export async function persistMessageCitations(input: {
  organizationId: string;
  messageId: string;
  hits: ProvenanceChunkHit[];
}): Promise<number> {
  void input;
  return 0;
}

/** Historical citations are unavailable after message_citations removal. */
export async function loadCitationsForMessages(
  organizationId: string,
  messageIds: string[],
): Promise<Map<string, DashboardCitation[]>> {
  void organizationId;
  void messageIds;
  return new Map();
}

export function hashCitationKey(messageId: string, chunkId: string): string {
  return createHash("sha256")
    .update(`${messageId}:${chunkId}`)
    .digest("hex")
    .slice(0, 16);
}
