"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useSessionView } from "@/components/session-view";

export function SupportWidgetHost() {
  const pathname = usePathname();
  const { user } = useSessionView();

  if (pathname?.startsWith("/dashboard") || pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <Script
      src="/v1/widget.js"
      strategy="afterInteractive"
      data-key="nk_live_td_-B38dwvP5MsQeXqAFPvls4L9pxXAW"
      // data-key="nk_live_Pyaqb5jhCyjxNgZKdKRvHK14898HTxx0"
      data-user-id={user?.id || ""}
      data-user-email={user?.email || ""}
      data-user-name={user?.name || ""}
    />
  );
}