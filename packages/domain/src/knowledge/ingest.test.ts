import { describe, expect, it } from "vitest";
import { chunkPlainText } from "./ingest";

describe("knowledge chunking", () => {
  it("keeps sliding-window chunking for non-website documents", () => {
    const text = Array.from(
      { length: 1_000 },
      (_, index) => `Generic document sentence ${index}.`,
    ).join(" ");
    expect(chunkPlainText(text).length).toBeGreaterThan(1);
  });
});
