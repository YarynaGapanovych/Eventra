"use client";

import { completeGoogleLogin } from "@/lib/google-auth";
import { useAuthStore } from "@/stores/auth-store";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

function GoogleAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const status = searchParams.get("google_auth");
    const code = searchParams.get("code");
    const message = searchParams.get("message");

    if (status === "success" && code) {
      void completeGoogleLogin(code)
        .then((auth) => {
          setSession(auth);
          router.replace("/calendar");
        })
        .catch((err) => {
          const msg =
            err instanceof Error ? err.message : "Google sign-in failed.";
          router.replace(`/?google_auth=error&message=${encodeURIComponent(msg)}`);
        });
      return;
    }

    const errorMessage =
      message?.trim() ||
      (status === "error" ? "Google sign-in was cancelled." : "Google sign-in failed.");
    router.replace(
      `/?google_auth=error&message=${encodeURIComponent(errorMessage)}`,
    );
  }, [router, searchParams, setSession]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <p className="text-base text-zinc-600 dark:text-zinc-400">
        Completing Google sign-in…
      </p>
    </main>
  );
}

export default function GoogleAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-6">
          <p className="text-base text-zinc-600 dark:text-zinc-400">
            Completing Google sign-in…
          </p>
        </main>
      }
    >
      <GoogleAuthCallbackContent />
    </Suspense>
  );
}
