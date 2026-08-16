/**
 * IMPORTANT: Use as-is with only `children` prop. No extra props needed.
 * The SDK handles all tracking configuration internally.
 */
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getOrCreateVisitorId, getOrCreateSessionId } from "@neylonai/sdk";

export function TrackingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    getOrCreateVisitorId();
    getOrCreateSessionId();
  }, [pathname]);

  return <>{children}</>;
}
