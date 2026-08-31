"use client";

import { useAuthStore } from "@/stores/auth-store";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function AppAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useAuthStore((s) => s.hydrated);
  const token = useAuthStore((s) => s.token);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!hydrated) return;

    if (!token) {
      setAllowed(false);
      router.replace("/");
      return;
    }
    setAllowed(true);
  }, [hydrated, token, router]);

  if (!hydrated || !allowed) {
    return (
      <div className="flex h-dvh flex-1 flex-col items-center justify-center gap-2 bg-linear-to-br from-zinc-100 via-white to-teal-50/40 p-8 text-sm text-zinc-600 dark:from-zinc-950 dark:via-zinc-950 dark:to-teal-950/20 dark:text-zinc-400">
        <p>Checking session…</p>
      </div>
    );
  }

  return <>{children}</>;
}
