"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useErrorStore } from "@/store/error-store";
import { useSessionStore } from "@/store/session-store";
import {
  loginWithGoogle,
  logout,
  waitForLiveSession,
} from "@/lib/neylon-session-api";
import type { UserResponse } from "@neylonai/sdk";

const DASHBOARD_PREFETCH_ROUTES = [
  "/dashboard",
  "/dashboard/agents",
  "/dashboard/conversations",
  "/dashboard/knowledge",
  "/dashboard/integrations",
  "/dashboard/widget",
  "/dashboard/usage",
  "/dashboard/billing",
  "/dashboard/settings",
  "/dashboard/developer",
];

export function useGoogleAuthHandler() {
  const { setUser, setLoading } = useSessionStore();
  const { setMessage, setStatus } = useErrorStore();
  const router = useRouter();

  const handleLogin = useCallback(async (res: { credential?: string }) => {
    try {
      setLoading(true);

      if (!res.credential) {
        setStatus("error");
        setMessage("Missing credential");
        return;
      }

      const responseData: UserResponse = await loginWithGoogle(res.credential);

      if (!responseData.success) {
        setStatus("error");
        if (responseData.error) {
          setMessage(responseData.error);
        }
        return;
      }

      if (responseData.user) {
        // Only claim "signed in" once the browser proves it will send the new
        // session cookie; the UI immediately offers a dashboard link, and a
        // cookie that is not live yet gets bounced back to the landing page.
        const confirmed = await waitForLiveSession();
        setUser(confirmed?.user ?? responseData.user);
        setStatus("saved");
        setMessage("Google Authentication Successful!");

        // Prefetch after the session cookie is confirmed live so that the
        // middleware lets the requests through and Next.js compiles/caches
        // every dashboard route in the background. Firing before confirmation
        // causes middleware to redirect the prefetch requests to "/" and
        // Next.js caches that redirect, blocking the actual navigation.
        for (const route of DASHBOARD_PREFETCH_ROUTES) {
          router.prefetch(route);
        }
      }
    } catch (err) {
      setStatus("error");
      setMessage("Internal server error");
      console.error("Authentication failed: ", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  const handleLogout = async () => {
    try {
      const response = await logout();

      if (response.success) {
        setUser(null);
      }
    } catch (err) {
      setStatus("error");
      setMessage("Internal Server Error");
      console.error("Logout failed:", err);
    }
  };
  return { handleLogin, handleLogout };
}
