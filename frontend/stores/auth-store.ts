import {
  clearStoredAuth,
  getStoredAuth,
  setStoredAuth,
  type AuthUser,
  type StoredAuth,
} from "@/lib/auth-api";
import { create } from "zustand";

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  hydrate: () => void;
  setSession: (auth: StoredAuth) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  hydrated: false,
  hydrate: () => {
    const auth = getStoredAuth();
    set({
      token: auth?.token ?? null,
      user: auth?.user ?? null,
      hydrated: true,
    });
  },
  setSession: (auth) => {
    setStoredAuth(auth);
    set({ token: auth.token, user: auth.user });
  },
  logout: () => {
    clearStoredAuth();
    set({ token: null, user: null });
  },
}));
