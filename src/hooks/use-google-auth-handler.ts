"use client";

import { useCallback } from "react";
import { useErrorStore } from "@/store/error-store";
import { useSessionStore } from "@/store/session-store";
import type { UserResponse } from "@/lib/types/types";
import { loginWithGoogle, logoutFromGoogle } from "@/lib/services/google-auth";

export function useGoogleAuthHandler() {
  const { setUser, setLoading } = useSessionStore();
  const { setMessage, setStatus } = useErrorStore();

  const handleLogin = useCallback(async (res: any) => {
    try {
      setLoading(true);

      const response = await loginWithGoogle(res.credential);
      const responseData: UserResponse = await response.json();

      if (!response.ok) {
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
  return { handleLogin, handleLogout };
}
