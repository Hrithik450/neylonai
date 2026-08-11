import type { IntegrationManifest } from "../catalog/types";

export const pdfManifest = {
  id: "pdf",
  name: "PDF",
  description:
    "Upload a PDF you own. Neylon extracts text, stores it in your knowledge base with embeddings, and keeps the original file available to download.",
  dataMode: "import",
  connectable: true,
  planBadge: "free",
  ingestKind: "upload",
} as const satisfies IntegrationManifest;
