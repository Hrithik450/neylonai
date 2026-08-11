import { createRegistry } from "../registry";
import type { WebSearchProvider } from "./types";

export const webSearchProviders = createRegistry<WebSearchProvider>();
