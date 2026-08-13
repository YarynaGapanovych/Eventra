"use client";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { useRouter } from "next/navigation";

export function HeaderUserArea() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  function signOut() {
    logout();
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
