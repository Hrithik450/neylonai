"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { SupportWidget } from "@neylonai/sdk/react";
import { useSessionView } from "@/components/session-view";
import { useErrorStore } from "@/store/error-store";
import { neylonWidgetCustomization } from "@/lib/neylon-customization";

export function SupportWidgetHost({
  apiKey: apiKeyProp = null,
}: {
  apiKey?: string | null;
} = {}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { user } = useSessionView();
  const { setStatus, setMessage } = useErrorStore();

  const apiKey =
    apiKeyProp?.trim() ||
    process.env.NEXT_PUBLIC_NEYLONAI_API_KEY?.trim() ||
    null;

  const onError = useCallback(
    (message: string) => {
      setStatus("error");
      setMessage(message);
    },
    [setStatus, setMessage],
  );

  const widgetUser = useMemo(
    () =>
      user
        ? {
            id: user.id,
            name: user.name,
            email: user.email,
            profile_image: user.profile_image,
          }
        : null,
    // Identity fields only — avoid new object when unrelated session fields change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, user?.name, user?.email, user?.profile_image],
  );

  const authFlag = searchParams?.get("auth");

  const config = useMemo(
    () => ({
      apiKey,
      pagePath: pathname,
      user: widgetUser,
      // Force-open after failed auth redirect (?auth=false).
      defaultOpen: authFlag === "false",
    }),
    [apiKey, authFlag, pathname, widgetUser],
  );

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

  return <SupportWidget config={config} onError={onError} />;
}
