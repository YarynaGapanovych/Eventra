"use client";

import { APP_AUTH_GATE_DISABLED } from "@/components/app-auth-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { apiLogin, apiRegister, getStoredAuth } from "@/lib/auth-api";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

type Mode = "login" | "register";

export function HomeAuth() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goApp = useCallback(() => router.replace("/calendar"), [router]);

  useEffect(() => {
    if (APP_AUTH_GATE_DISABLED) return;
    if (getStoredAuth()?.token) void goApp();
  }, [goApp]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const em = email.trim();
    const pw = password;
    if (!em || !pw) {
      setError("Enter email and password.");
      return;
    }

    if (mode === "register") {
      if (pw.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (pw !== confirm) {
        setError("Passwords do not match.");
        return;
      }
    }

    setPending(true);
    try {
      if (mode === "login") {
        await apiLogin(em, pw);
      } else {
        await apiRegister({
          email: em,
          password: pw,
          name: name.trim() || undefined,
        });
      }
      goApp();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 space-y-2 text-center sm:text-left">
        <p className="font-semibold uppercase tracking-[0.2em] text-teal-700 dark:text-teal-400">
          Eventra
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Schedule work together
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Sign in to open your calendar and tasks.
        </p>
      </div>

      <div
        className="mb-6 flex rounded-lg border border-zinc-200 bg-zinc-50/80 p-1 dark:border-zinc-800 dark:bg-zinc-900/60"
        role="tablist"
      >
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium capitalize transition-colors",
              mode === m
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
            )}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
          >
            {m === "login" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form
        className="space-y-4 rounded-xl border border-zinc-200/90 bg-white/90 p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950/85"
        onSubmit={(ev) => void submit(ev)}
      >
        {mode === "register" ? (
          <div className="space-y-2">
            <Label htmlFor="reg-name">Name (optional)</Label>
            <Input
              id="reg-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="auth-email">Email</Label>
          <Input
            id="auth-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="auth-password">Password</Label>
          <Input
            id="auth-password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder={
              mode === "register" ? "At least 8 characters" : undefined
            }
          />
        </div>

        {mode === "register" ? (
          <div className="space-y-2">
            <Label htmlFor="auth-confirm">Confirm password</Label>
            <Input
              id="auth-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}

        <Button
          type="submit"
          className="w-full bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600"
          disabled={pending}
        >
          {pending
            ? "Please wait…"
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-500">
        Requires the Nest API running (defaults to{" "}
        <span className="font-mono">http://localhost:3001</span> unless{" "}
        <span className="font-mono">NEXT_PUBLIC_API_URL</span> is set).
      </p>
    </div>
  );
}
