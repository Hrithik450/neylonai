"use client";

import { useCallback } from "react";
import { useErrorStore } from "@/store/error-store";
import { useSessionStore } from "@/store/session-store";
import { loginWithGoogle, logout } from "@/lib/neylon-session-api";
import type { UserResponse } from "@neylonai/sdk";

export function useGoogleAuthHandler() {
  const { setUser, setLoading } = useSessionStore();
  const { setMessage, setStatus } = useErrorStore();

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
        setUser(responseData.user);
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
