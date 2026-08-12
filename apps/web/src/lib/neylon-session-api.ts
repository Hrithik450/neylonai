/**
 * First-party Neylon site session helpers (same-origin).
 * Not part of the public customer SDK — hosts use their own auth.
 */
import type { UserResponse } from "@neylonai/sdk";

export async function loginWithGoogle(
  credential: string,
): Promise<UserResponse> {
  const formData = new URLSearchParams();
  formData.append("credential", credential);

  const response = await fetch("/api/v1/google-login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });

  return (await response.json()) as UserResponse;
}

export async function logout(): Promise<{
  success: boolean;
  error?: string | null;
}> {
  const response = await fetch("/api/v1/logout", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });

  return (await response.json()) as { success: boolean; error?: string | null };
}

export async function getMe(): Promise<UserResponse> {
  const response = await fetch("/api/v1/me", {
    method: "GET",
    credentials: "include",
  });

  return (await response.json()) as UserResponse;
}
