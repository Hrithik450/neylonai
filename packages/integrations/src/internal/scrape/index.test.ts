import { describe, expect, it } from "vitest";
import { stripHtml } from "./index";

describe("stripHtml", () => {
  it("preserves page headings as markdown section boundaries", () => {
    const result = stripHtml(`
      <html>
        <head><title>Acme</title></head>
        <body>
          <h1>Product overview</h1>
          <p>Grounded answers for customer support teams.</p>
          <h2>Pricing and plans</h2>
          <p>Plans for different support volumes and requirements.</p>
        </body>
      </html>
    `);

    expect(result.text).toContain("# Product overview");
    expect(result.text).toContain("## Pricing and plans");
  });
});
