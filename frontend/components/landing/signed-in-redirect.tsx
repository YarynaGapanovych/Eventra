"use client";

import { useAuthStore } from "@/stores/auth-store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Sends signed-in visitors from the public landing page into the app. */
export function SignedInRedirect() {
  const router = useRouter();
  const hydrated = useAuthStore((s) => s.hydrated);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (hydrated && token) router.replace("/calendar");
  }, [hydrated, router, token]);

  return null;
}
