import type { AuthUser, StoredAuth } from "@/lib/auth-api";
import { API_BASE } from "@/lib/tasks-api";

export function getGoogleLoginConnectUrl(): string {
  const redirectUri =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/google/callback`
      : "/auth/google/callback";
  const url = new URL(`${API_BASE}/auth/google/connect`);
  url.searchParams.set("redirect_uri", redirectUri);
  return url.toString();
}

export function startGoogleLogin(): void {
  window.location.href = getGoogleLoginConnectUrl();
}

export async function completeGoogleLogin(code: string): Promise<StoredAuth> {
  const res = await fetch(`${API_BASE}/auth/google/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = "Google sign-in failed.";
    try {
      const j = JSON.parse(text) as { message?: string | string[] };
      const m = j.message;
      if (typeof m === "string") msg = m;
      else if (Array.isArray(m) && typeof m[0] === "string") msg = m[0];
    } catch {
      if (text.trim()) msg = text.slice(0, 400);
    }
    throw new Error(msg);
  }
  const data = JSON.parse(text) as {
    accessToken?: string;
    user?: AuthUser;
  };
  if (!data.accessToken || !data.user) {
    throw new Error("Google sign-in failed.");
  }
  return { token: data.accessToken, user: data.user };
}
