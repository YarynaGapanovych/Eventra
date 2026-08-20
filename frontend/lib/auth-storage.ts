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
