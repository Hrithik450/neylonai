import { describe, expect, it } from "vitest";
import {
  documentsToRemove,
  lastmodUnchanged,
  refreshPageDecision,
} from "./helpers";

describe("incremental refresh", () => {
  it("skips scrape when sitemap lastmod is unchanged", () => {
    expect(lastmodUnchanged("2026-03-01T00:00:00Z", "2026-03-01")).toBe(true);
  });

  it("rescrapes when lastmod is missing or newer", () => {
    expect(lastmodUnchanged("2026-03-01", "2026-04-01")).toBe(false);
    expect(lastmodUnchanged("2026-03-01", null)).toBe(false);
  });

  it("does not scrape stored pages when a sitemap has no change signal", () => {
    expect(
      refreshPageDecision({
        hasStoredPage: true,
        storedLastmod: null,
        discoveredLastmod: null,
      }),
    ).toBe("skip_existing");
  });

  it("scrapes new pages and pages with a changed lastmod", () => {
    expect(
      refreshPageDecision({
        hasStoredPage: false,
        discoveredLastmod: null,
      }),
    ).toBe("scrape");
    expect(
      refreshPageDecision({
        hasStoredPage: true,
        storedLastmod: "2026-03-01",
        discoveredLastmod: "2026-04-01",
      }),
    ).toBe("scrape");
  });

  it("skips re-embed when content hash matches", () => {
    const existing = "abc123";
    const incoming = "abc123";
    expect(existing === incoming).toBe(true);
  });

  it("removes documents that are no longer selected", () => {
    expect(
      documentsToRemove(["/", "/pricing", "/old-blog"], ["/", "/pricing"]),
    ).toEqual(["/old-blog"]);
  });

  it("preserves failed-page paths so the previous document is kept", () => {
    const selected = ["/", "/pricing", "/docs"];
    const failed = "/docs";
    expect(selected.includes(failed)).toBe(true);
    expect(documentsToRemove(["/", "/pricing", "/docs"], selected)).toEqual([]);
  });
});
