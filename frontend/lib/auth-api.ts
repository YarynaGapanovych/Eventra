import { graphqlRequest } from "@/lib/graphql";
import { LOGIN_MUTATION, REGISTER_MUTATION } from "@/lib/graphql/mutations";

export const AUTH_STORAGE_KEY = "eventra.auth.v1";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
};

export type StoredAuth = {
  token: string;
  user: AuthUser;
};

type AuthPayloadResponse = {
  login?: { accessToken: string; user: AuthUser };
  register?: { accessToken: string; user: AuthUser };
};

export function getStoredAuth(): StoredAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    if (
      parsed &&
      typeof parsed.token === "string" &&
      parsed.user &&
      typeof parsed.user.email === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function notifyAuthChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("eventra-auth"));
}

export function setStoredAuth(auth: StoredAuth): void {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
  notifyAuthChanged();
}

export function clearStoredAuth(): void {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  notifyAuthChanged();
}

export async function apiRegister(body: {
  email: string;
  password: string;
  name?: string;
}): Promise<StoredAuth> {
  const data = await graphqlRequest<AuthPayloadResponse>(REGISTER_MUTATION, {
    input: body,
  });
  const payload = data.register;
  if (!payload) {
    throw new Error("Register failed");
  }
  return { token: payload.accessToken, user: payload.user };
}

export async function apiLogin(
  email: string,
  password: string,
): Promise<StoredAuth> {
  const data = await graphqlRequest<AuthPayloadResponse>(LOGIN_MUTATION, {
    input: { email, password },
  });
  const payload = data.login;
  if (!payload) {
    throw new Error("Invalid email or password");
  }
  return { token: payload.accessToken, user: payload.user };
}
