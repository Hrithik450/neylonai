import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  getTrackedPageSection,
  clearTrackedPageSection,
} from "./page-context";
import {
  qualifyPageSection,
  subscribeToQualifiedPageSection,
  observePageSection,
} from "./section-dwell";

describe("section dwell qualification", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearTrackedPageSection();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearTrackedPageSection();
  });

  it("qualifyPageSection tracks and notifies immediately", () => {
    const qualified: string[] = [];
    subscribeToQualifiedPageSection((section) => {
      qualified.push(section.sectionId);
    });

    qualifyPageSection({ sectionId: "pricing", pagePath: "/" });

    expect(getTrackedPageSection()?.sectionId).toBe("pricing");
    expect(qualified).toEqual(["pricing"]);
  });

  it("observePageSection cancels qualification when section leaves early", () => {
    vi.stubGlobal("window", {
      location: { pathname: "/" },
    });

    const qualified: string[] = [];
    subscribeToQualifiedPageSection((section) => {
      qualified.push(section.sectionId);
    });

    let observerCallback: IntersectionObserverCallback | null = null;
    class MockIntersectionObserver {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
      takeRecords = vi.fn(() => [] as IntersectionObserverEntry[]);
      readonly root = null;
      readonly rootMargin = "";
      readonly thresholds: readonly number[] = [];
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
      }
    }

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

    const element = { tagName: "SECTION" } as Element;
    observePageSection(element, "hero", {
      pagePath: "/",
      dwellMs: 4_000,
      intersectionRatio: 0.35,
    });

    expect(observerCallback).toBeTruthy();
    observerCallback!(
      [
        {
          isIntersecting: true,
          intersectionRatio: 0.5,
          target: element,
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    );

    expect(getTrackedPageSection()?.sectionId).toBe("hero");

    observerCallback!(
      [
        {
          isIntersecting: false,
          intersectionRatio: 0,
          target: element,
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    );

    vi.advanceTimersByTime(5_000);
    expect(qualified).toEqual([]);
  });
});
