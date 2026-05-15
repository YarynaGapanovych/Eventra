"use client";

import { useAuthStore } from "@/stores/auth-store";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Temporary: bypass login for `/calendar`, `/tasks`, etc.
 * Flip to `false` when you're ready to require auth again.
 */
export const APP_AUTH_GATE_DISABLED = true;

export function AppAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useAuthStore((s) => s.hydrated);
  const token = useAuthStore((s) => s.token);
  const [allowed, setAllowed] = useState(() => APP_AUTH_GATE_DISABLED);

  useEffect(() => {
    if (APP_AUTH_GATE_DISABLED) return;
    if (!hydrated) return;

    if (!token) {
      router.replace("/");
      return;
    }
    setAllowed(true);
  }, [hydrated, token, router]);

  if (!APP_AUTH_GATE_DISABLED && (!hydrated || !allowed)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-sm text-zinc-600 dark:text-zinc-400">
        <p>Checking session…</p>
      </div>
    );
  }

  return <>{children}</>;
}
