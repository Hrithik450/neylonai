import "./providers/postgres";

export type {
  KnowledgeSearchProvider,
  KnowledgeSearchHit,
} from "./types";
export { knowledgeSearchProviders } from "./registry";
export {
  postgresKnowledgeSearchProvider,
  DEFAULT_EMBEDDING_MODEL,
} from "./providers/postgres";
