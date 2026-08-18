import { describe, expect, it } from "vitest";
import { extractDomPageSections, htmlToPlainText } from "./dom-sections";

describe("extractDomPageSections", () => {
  it("extracts sections from element ids in document order", () => {
    const html = `
      <main>
        <section id="home-overview" aria-label="Home overview">
          <h1>Welcome</h1>
          <p>Engage visitors sooner.</p>
        </section>
        <section id="pricing">
          <h2>Plans</h2>
          <p>Starting at $19.</p>
        </section>
      </main>
    `;

    expect(extractDomPageSections(html)).toEqual([
      {
        sectionId: "home-overview",
        label: "Home overview",
        content: "Welcome\n\nEngage visitors sooner.",
      },
      {
        sectionId: "pricing",
        label: "Plans",
        content: "Plans\n\nStarting at $19.",
      },
    ]);
  });

  it("dedupes repeated section ids", () => {
    const html = `
      <section id="hero">First hero section content here.</section>
      <section id="hero">Duplicate hero section content here.</section>
    `;
    expect(extractDomPageSections(html)).toHaveLength(1);
  });

  it("returns empty when no section ids exist", () => {
    expect(extractDomPageSections("<section>Hello</section>")).toEqual([]);
  });

  it("ignores layout shell ids", () => {
    expect(
      extractDomPageSections('<section id="root">Layout shell content here.</section>'),
    ).toEqual([]);
  });
});

describe("htmlToPlainText", () => {
  it("strips tags and decodes entities", () => {
    expect(htmlToPlainText("<p>Hello&nbsp;<strong>world</strong></p>")).toBe(
      "Hello world",
    );
  });
});
