import { createRegistry } from "@neylonai/integrations";
import type { KnowledgeSearchProvider } from "./types";

export const knowledgeSearchProviders =
  createRegistry<KnowledgeSearchProvider>();
