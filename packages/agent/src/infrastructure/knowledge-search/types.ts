/** First-party knowledge-base retrieval (org-scoped pgvector). Not an external web search. */

export type KnowledgeSearchHit = {
  chunkId: string;
  documentId: string;
  sourceId: string | null;
  content: string;
  score: number;
  externalChunkId?: string;
};

export interface KnowledgeSearchProvider {
  name: string;
  search(query: string): Promise<KnowledgeSearchHit[]>;
}
