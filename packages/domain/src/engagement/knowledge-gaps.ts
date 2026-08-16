import { createHash } from "node:crypto";
import type { KnowledgeGapType } from "@neylonai/database";

export type KnowledgeGapAggregate = {
  questionHash: string;
  pagePath: string | null;
  sampleQuestion: string;
  count: number;
  gapTypes: KnowledgeGapType[];
  latestAt: string;
  threadId: string | null;
  messageId: string | null;
};

export function normalizeQuestionForHash(question: string): string {
  return question
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 400);
}

export function hashKnowledgeGapQuestion(question: string): string {
  const normalized = normalizeQuestionForHash(question);
  if (!normalized) {
    return createHash("sha256").update("empty").digest("hex").slice(0, 64);
  }
  return createHash("sha256").update(normalized).digest("hex").slice(0, 64);
}

export function buildKnowledgeGapDedupKey(input: {
  messageId?: string | null;
  requestId?: string | null;
  gapType: KnowledgeGapType;
}): string {
  const anchor = input.messageId?.trim() || input.requestId?.trim();
  if (!anchor) {
    throw new Error("Knowledge gap dedup requires messageId or requestId");
  }
  return `${anchor}:${input.gapType}`;
}

export async function recordKnowledgeGapEvent(input: {
  organizationId: string;
  gapType: KnowledgeGapType;
  sampleQuestion: string;
  messageId?: string | null;
  requestId?: string | null;
  threadId?: string | null;
  participantId?: string | null;
  pagePath?: string | null;
  retrievalHitCount?: number | null;
}): Promise<boolean> {
  void input;
  return false;
}

export async function aggregateKnowledgeGaps(
  organizationId: string,
  options?: { windowDays?: number; limit?: number },
): Promise<KnowledgeGapAggregate[]> {
  void organizationId;
  void options;
  return [];
}

export function gapTypeToLabel(gapType: KnowledgeGapType): string {
  switch (gapType) {
    case "no_retrieval":
      return "No sources retrieved";
    case "negative_feedback":
      return "Negative feedback";
    case "unhelpful_escalation":
      return "Unhelpful escalation";
    case "low_confidence_escalation":
      return "Low-confidence escalation";
    default:
      return gapType;
  }
}

export async function finalizeAssistantEngagement(input: {
  organizationId: string;
  threadId: string;
  assistantMessageId: string;
  userQuestion: string;
  pagePath?: string | null;
  requestId?: string | null;
  provenanceHits: import("../knowledge/provenance").ProvenanceChunkHit[];
}): Promise<void> {
  void input;
}
