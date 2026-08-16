"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  observeNeylonSection,
  type NeylonPagePath,
  type NeylonSectionKey,
} from "@/neylon-sections";

export interface UseSectionTrackingOptions<P extends NeylonPagePath> {
  pagePath: P;
  sectionKey: NeylonSectionKey<P>;
  sectionLabel?: string;
}

/**
 * Tracks when a user views a specific section of the page.
 * Automatically reports to Neylon AI for visitor behavior analysis.
 */
export function useSectionTracking<P extends NeylonPagePath>(
  options: UseSectionTrackingOptions<P>,
) {
  const pathname = usePathname();
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    return observeNeylonSection(element, {
      pagePath: options.pagePath,
      sectionKey: options.sectionKey,
      sectionLabel: options.sectionLabel,
    });
  }, [pathname, options.pagePath, options.sectionKey, options.sectionLabel]);

  return elementRef;
}
