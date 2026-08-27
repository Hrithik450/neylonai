"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useSessionView } from "@/components/session-view";

export function SupportWidgetHost({
  apiKey: apiKeyProp = null,
}: {
  apiKey?: string | null;
} = {}) {
  const pathname = usePathname();
  const { user } = useSessionView();

  const apiKey =
    apiKeyProp?.trim() ||
    process.env.NEXT_PUBLIC_NEYLONAI_API_KEY?.trim() ||
    null;

  if (pathname?.startsWith("/dashboard") || pathname?.startsWith("/admin")) {
    return null;
  }

  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[Neylon AI] No site API key — set NEXT_PUBLIC_NEYLONAI_API_KEY.",
      );
    }
    return null;
  }

  // Example of using the new Script Tag Injection method securely on your own site!
  // We pass the user attributes straight to the script tag (which we just built).
  return (
    <Script
      src="/v1/widget.js"
      strategy="afterInteractive"
      data-key={apiKey}
      data-user-id={user?.id || ""}
      data-user-email={user?.email || ""}
      data-user-name={user?.name || ""}
    />
  );
}
