import type { AuthUser, StoredAuth } from "@/lib/auth-api";
import { graphqlRequest } from "@/lib/graphql";
import { COMPLETE_GOOGLE_LOGIN_MUTATION } from "@/lib/graphql/mutations";
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
  const data = await graphqlRequest<{
    completeGoogleLogin?: { accessToken: string; user: AuthUser };
  }>(COMPLETE_GOOGLE_LOGIN_MUTATION, { code });
  const payload = data.completeGoogleLogin;
  if (!payload?.accessToken || !payload.user) {
    throw new Error("Google sign-in failed.");
  }
  return { token: payload.accessToken, user: payload.user };
}
