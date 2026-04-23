"use client";

import { useCallback } from "react";
import { useErrorStore } from "@/store/store";
import { useSessionStore } from "@/store/session-store";
import {
  loginWithGoogleToken,
  logoutFromGoogle,
} from "@/lib/services/google-auth";
import type { SessionResponse } from "@/lib/types/request-response";
import { useGoogleRefButtons } from "@/providers/google-buttons-ref-provider";

export function useGoogleAuth() {
  const { desktopButtonRef, mobileButtonRef } = useGoogleRefButtons();

  const { setUser, setLoading } = useSessionStore();
  const { setMessage, setStatus } = useErrorStore();

  const clearButtons = () => {
    if (desktopButtonRef.current) {
      desktopButtonRef.current.innerHTML = "";
    }
    if (mobileButtonRef.current) {
      mobileButtonRef.current.innerHTML = "";
    }
  };

  const handleCredential = useCallback(async (res: any) => {
    try {
      clearButtons();
      setLoading(true);

      const response = await loginWithGoogleToken(res.credential);
      const responseData: SessionResponse = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(responseData.error);
        return;
      }

      if (responseData.data?.user) {
        setUser(responseData.data.user);
        setStatus("saved");
        setMessage("Google Authentication Successful!");
      }
    } catch (err) {
      setStatus("error");
      setMessage("Internal server error");
      console.error("Authentication failed: ", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogout = async () => {
    try {
      const response = await logoutFromGoogle();
      if (response.ok) {
        setUser(null);
      }
    } catch (err) {
      setStatus("error");
      setMessage("Internal Server Error");
      console.error("Logout failed:", err);
    }
  };
  return { handleCredential, handleLogout };
}
