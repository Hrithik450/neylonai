import { describe, expect, it } from "vitest";
import {
  cleanHeading,
  deterministicCleanPageText,
  sectionIdFromHeading,
} from "./page-text";

describe("sectionIdFromHeading", () => {
  it("normalizes a heading into a slug", () => {
    expect(sectionIdFromHeading("Pricing & Plans!")).toBe("pricing-plans");
  });

  it("strips markup and collapses separators", () => {
    expect(sectionIdFromHeading("<h2>How  it works</h2>")).toBe("how-it-works");
  });
});

describe("cleanHeading", () => {
  it("unwraps links and drops markdown emphasis", () => {
    expect(cleanHeading("**[Pricing](/pricing)** _plans_")).toBe(
      "Pricing plans",
    );
  });
});

describe("deterministicCleanPageText", () => {
  it("drops cookie and nav chrome but keeps content", () => {
    const cleaned = deterministicCleanPageText(
      [
        "Skip to main content",
        "Cookie preferences",
        "",
        "Acme helps teams answer questions.",
      ].join("\n"),
    );

    expect(cleaned).toBe("Acme helps teams answer questions.");
  });

  it("collapses runs of blank lines", () => {
    expect(deterministicCleanPageText("A\n\n\n\nB")).toBe("A\n\nB");
  });
});
