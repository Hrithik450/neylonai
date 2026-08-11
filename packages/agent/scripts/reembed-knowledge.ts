/**
 * Re-embed all knowledge_chunks with Gemini (gemini-embedding-001, 3072 dims).
 *
 * Required because OpenAI and Gemini embeddings are incompatible vector spaces
 * even when both are 3072-dimensional.
 *
 * Usage (from repo root):
 *   DATABASE_URL=... DATABASE_SSL=false GOOGLE_API_KEYS=key1,key2 \
 *     pnpm --filter @neylonai/agent run reembed:knowledge
 */
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { eq } from "drizzle-orm";
import {
  db,
  knowledgeChunks,
  resolveDevKnowledgeScope,
  KNOWLEDGE_EMBEDDING_DIMENSIONS,
} from "@neylonai/database";
import { withGoogleApiRetry } from "@neylonai/integrations";
import { DEFAULT_EMBEDDING_MODEL } from "../src/infrastructure/knowledge-search";

const BATCH = 8;
const MODEL = process.env.EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  // Dev/ops script only — production request paths must use authenticated organizationId.
  const scope = await resolveDevKnowledgeScope();
  if (!scope) {
    throw new Error(
      "Knowledge scope not found — set KNOWLEDGE_ORGANIZATION_SLUG for this script, or pass a real org via resolveKnowledgeScope({ organizationId })",
    );
  }

  const chunks = await db
    .select({
      id: knowledgeChunks.id,
      content: knowledgeChunks.content,
    })
    .from(knowledgeChunks)
    .where(eq(knowledgeChunks.organization_id, scope.organizationId));

  console.log(
    `Re-embedding ${chunks.length} chunks for org ${scope.organizationSlug} with ${MODEL} (${KNOWLEDGE_EMBEDDING_DIMENSIONS}d)…`,
  );

  let updated = 0;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const vectors = await withGoogleApiRetry(async (apiKey) => {
      const embeddings = new GoogleGenerativeAIEmbeddings({
        model: MODEL,
        apiKey,
        taskType: TaskType.RETRIEVAL_DOCUMENT,
      });
      return embeddings.embedDocuments(batch.map((c) => c.content));
    });

    for (let j = 0; j < batch.length; j++) {
      const vec = vectors[j];
      if (!vec || vec.length === 0) {
        throw new Error(`Empty embedding for chunk ${batch[j].id}`);
      }
      if (vec.length !== KNOWLEDGE_EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Expected ${KNOWLEDGE_EMBEDDING_DIMENSIONS} dims, got ${vec.length} for ${batch[j].id}`,
        );
      }

      await db
        .update(knowledgeChunks)
        .set({
          embedding: vec,
          updated_at: new Date(),
        })
        .where(eq(knowledgeChunks.id, batch[j].id));
      updated += 1;
    }

    console.log(`  ${Math.min(i + BATCH, chunks.length)}/${chunks.length}`);
    await sleep(400);
  }

  console.log(`Done. Updated ${updated} chunks with ${MODEL}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
