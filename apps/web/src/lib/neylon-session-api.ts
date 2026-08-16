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

/**
 * Polls `/api/v1/me` until the freshly issued session cookie is actually sent
 * back by the browser. WebKit can lag between storing a `Set-Cookie` from a
 * fetch response and attaching it to the next request, which otherwise lets the
 * UI offer a dashboard link that the middleware bounces straight back to `/`.
 *
 * Defaults are generous for Safari/WebKit, which can take 1–2 s to commit a
 * cookie from a fetch Set-Cookie to its native navigation store.
 */
export async function waitForLiveSession(
  attempts = 8,
  delayMs = 300,
): Promise<UserResponse | null> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const me = await getMe();
      if (me.success && me.user) return me;
    } catch {
      // network hiccup — fall through to the retry
    }
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return null;
}

export async function getMe(): Promise<UserResponse> {
  const response = await fetch("/api/v1/me", {
    method: "GET",
    credentials: "include",
  });

  return (await response.json()) as UserResponse;
}
