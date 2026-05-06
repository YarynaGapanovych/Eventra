"use client";

import { Button } from "@/components/ui/button";
import {
  AUTH_STORAGE_KEY,
  clearStoredAuth,
  type AuthUser,
} from "@/lib/auth-api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function HeaderUserArea() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    function read() {
      try {
        const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
        if (!raw) {
          setUser(null);
          return;
        }
        const parsed = JSON.parse(raw) as { user?: AuthUser };
        setUser(parsed.user ?? null);
      } catch {
        setUser(null);
      }
    }

    read();
    window.addEventListener("storage", read);
    window.addEventListener("eventra-auth", read);

    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("eventra-auth", read);
    };
  }, []);

  function signOut() {
    clearStoredAuth();
    router.replace("/");
  }

  if (!user) return null;

  const label =
    user.name?.trim() || user.email.split("@")[0]?.trim() || user.email;

  return (
    <div className="flex max-w-[11rem] flex-col items-end justify-center gap-1 sm:flex-row sm:items-center sm:gap-2 lg:max-w-xs">
      <span
        className="truncate text-xs text-zinc-500 dark:text-zinc-400"
        title={user.email}
      >
        {label}
      </span>
      <Button
        type="button"
        variant="outline"
        size="xs"
        className="shrink-0"
        onClick={() => signOut()}
      >
        Sign out
      </Button>
    </div>
  );
}
