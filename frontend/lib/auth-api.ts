import { API_BASE } from "@/lib/tasks-api";

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
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text?.trim() ? text.slice(0, 400) : `Register failed (${res.status})`;
    try {
      const j = JSON.parse(text) as { message?: string | string[] };
      if (Array.isArray(j.message)) msg = j.message.join(", ");
      else if (typeof j.message === "string") msg = j.message;
    } catch {
      /* keep msg from body or default */
    }
    throw new Error(msg);
  }
  const data = JSON.parse(text) as {
    accessToken: string;
    user: AuthUser;
  };
  const auth = { token: data.accessToken, user: data.user };
  setStoredAuth(auth);
  return auth;
}

export async function apiLogin(
  email: string,
  password: string,
): Promise<StoredAuth> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = "Invalid email or password";
    try {
      const j = JSON.parse(text) as { message?: string };
      if (typeof j.message === "string") msg = j.message;
    } catch {
      if (text?.trim()) msg = text.slice(0, 400);
    }
    throw new Error(msg);
  }
  const data = JSON.parse(text) as {
    accessToken: string;
    user: AuthUser;
  };
  const auth = { token: data.accessToken, user: data.user };
  setStoredAuth(auth);
  return auth;
}
