"use client";

import { APP_AUTH_GATE_DISABLED } from "@/components/app-auth-gate";
import { AuthSplitLayout } from "@/components/auth-split-layout";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { LoginForm } from "@/components/login-form";
import { RegisterForm } from "@/components/register-form";
import { useAuthStore } from "@/stores/auth-store";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

type Mode = "login" | "register" | "forgot";

function HomeAuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("login");

  const googleAuthError =
    searchParams.get("google_auth") === "error"
      ? searchParams.get("message")?.trim() || "Google sign-in failed."
      : null;

  const goApp = useCallback(() => router.replace("/calendar"), [router]);
  const hydrated = useAuthStore((s) => s.hydrated);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (APP_AUTH_GATE_DISABLED) return;
    if (!hydrated) return;
    if (token) void goApp();
  }, [goApp, hydrated, token]);

  return (
    <AuthSplitLayout>
      {googleAuthError ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {googleAuthError}
        </p>
      ) : null}
      {mode === "login" ? (
        <LoginForm
          onSuccess={goApp}
          onRequestRegister={() => setMode("register")}
          onRequestForgotPassword={() => setMode("forgot")}
        />
      ) : mode === "register" ? (
        <RegisterForm
          onSuccess={goApp}
          onRequestLogin={() => setMode("login")}
        />
      ) : (
        <ForgotPasswordForm onRequestLogin={() => setMode("login")} />
      )}
    </AuthSplitLayout>
  );
}

export function HomeAuth() {
  return (
    <Suspense fallback={null}>
      <HomeAuthContent />
    </Suspense>
  );
}
