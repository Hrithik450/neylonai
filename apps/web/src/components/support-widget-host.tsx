"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useSessionView } from "@/components/session-view";

export function SupportWidgetHost() {
  const pathname = usePathname();
  const { user } = useSessionView();

  if (pathname?.startsWith("/dashboard") || pathname?.startsWith("/admin")) {
    return null;
  }

  const apiKey =
    process.env.NEXT_PUBLIC_NEYLONAI_API_KEY ||
    (process.env.NODE_ENV === "production"
      ? "nk_live_td_-B38dwvP5MsQeXqAFPvls4L9pxXAW" : "nk_live_Pyaqb5jhCyjxNgZKdKRvHK14898HTxx0");

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