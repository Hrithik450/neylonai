import type { IntegrationModule } from "../catalog/module";
import { pdfManifest } from "./manifest";

export { pdfManifest } from "./manifest";

/** Max extractable characters kept after PDF text extraction. */
export const PDF_MAX_EXTRACT_CHARS = 500_000;

/**
 * PDF Import adapter: extract plain text from a PDF buffer.
 * Ingest / storage stay in @neylonai/domain knowledge.
 */
export async function extractPdfText(bytes: Buffer): Promise<string> {
  // Dynamic import: pdf-parse breaks Next/webpack when loaded at module top-level.
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    const text = (result.text ?? "").replace(/\s+/g, " ").trim();
    if (!text) {
      throw new Error(
        "No extractable text in this PDF (it may be image-only or encrypted).",
      );
    }
    return text.slice(0, PDF_MAX_EXTRACT_CHARS);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

export const pdfIntegration = {
  manifest: pdfManifest,
  extractText: extractPdfText,
} as const satisfies IntegrationModule & {
  extractText: typeof extractPdfText;
};
