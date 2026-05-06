"use client";

import { getStoredAuth } from "@/lib/auth-api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Temporary: bypass login for `/calendar`, `/tasks`, etc.
 * Flip to `false` when you're ready to require auth again.
 */
export const APP_AUTH_GATE_DISABLED = true;

export function AppAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(() => APP_AUTH_GATE_DISABLED);

  useEffect(() => {
    if (APP_AUTH_GATE_DISABLED) return;

    /* eslint-disable react-hooks/set-state-in-effect -- Auth gate reads localStorage then allows render */
    const auth = getStoredAuth();
    if (!auth?.token) {
      router.replace("/");
      return;
    }
    setAllowed(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [router]);

  if (!APP_AUTH_GATE_DISABLED && !allowed) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-sm text-zinc-600 dark:text-zinc-400">
        <p>Checking session…</p>
      </div>
    );
  }

  return <>{children}</>;
}
