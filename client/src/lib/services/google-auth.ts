export const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export function getCookie(name: string) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift();
}

export async function loginWithGoogleToken(credential: string) {
  const formData = new URLSearchParams();
  formData.append("credential", credential);

  return await fetch(`${BASE_URL}/accounts/google/login/one-tap/`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });
}

export async function logoutFromGoogle() {
  return await fetch(`${BASE_URL}/accounts/google/logout/`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
  });
}
