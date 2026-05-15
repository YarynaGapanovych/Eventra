"use client";

import { APP_AUTH_GATE_DISABLED } from "@/components/app-auth-gate";
import { LoginForm } from "@/components/login-form";
import { RegisterForm } from "@/components/register-form";
import { useAuthStore } from "@/stores/auth-store";
import { CalendarDays, Clock3, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Mode = "login" | "register";

export function HomeAuth() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");

  const goApp = useCallback(() => router.replace("/calendar"), [router]);
  const hydrated = useAuthStore((s) => s.hydrated);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (APP_AUTH_GATE_DISABLED) return;
    if (!hydrated) return;
    if (token) void goApp();
  }, [goApp, hydrated, token]);

  return (
    <main className="grid h-screen w-full md:grid-cols-2 md:items-stretch">
      <div className="relative overflow-hidden bg-black pl-16 pr-8 pt-12 pb-14 text-left md:pl-12 md:pr-8 md:pt-14 md:pb-16 lg:pl-16 lg:pr-12 lg:pt-16 lg:pb-18">
        <div className="pointer-events-none absolute -left-12 top-8 h-72 w-72 rounded-full border border-teal-700/35" />
        <div className="pointer-events-none absolute -right-30 top-28 h-132 w-132 rounded-full border border-teal-700/30" />
        <div className="pointer-events-none absolute -right-20 -bottom-28 h-96 w-96 rounded-full border border-teal-700/24" />
        <div className="pointer-events-none absolute left-28 -top-10 h-56 w-56 rounded-full border border-teal-600/28" />
        <div className="pointer-events-none absolute -left-24 bottom-14 h-80 w-80 rounded-full border border-teal-800/30" />
        <div className="pointer-events-none absolute right-20 top-10 h-40 w-40 rounded-full border border-teal-500/24" />
        <div className="pointer-events-none absolute left-44 bottom-16 h-52 w-52 rounded-full border border-teal-600/24" />
        <div className="pointer-events-none absolute -right-8 bottom-44 h-64 w-64 rounded-full border border-teal-700/24" />
        <div className="pointer-events-none absolute right-32 -bottom-8 h-44 w-44 rounded-full border border-teal-500/20" />

        <div className="relative z-10">
          <p className="text-3xl font-semibold leading-none uppercase tracking-[0.08em] text-teal-600 md:text-4xl lg:text-5xl">
            Eventra
          </p>
          <div className="mt-[28%] flex flex-col gap-14">
            <h1 className=" text-5xl font-semibold leading-[0.95] tracking-tight text-balance text-zinc-100  md:text-6xl  lg:text-7xl">
              Schedule work together
            </h1>
            <p className="text-lg leading-relaxed text-zinc-400  md:text-xl lg:text-2xl">
              Coordinate seamlessly with your team. Manage calendars, tasks, and
              meetings in one unified workspace.
            </p>

            <ul className=" space-y-4   lg:space-y-5">
              <li className="flex items-center gap-4 lg:gap-5">
                <span className="inline-flex size-12 items-center justify-center rounded-2xl border border-teal-900/45 bg-teal-950/25 text-teal-600 lg:size-14">
                  <CalendarDays className="size-6 lg:size-7" aria-hidden />
                </span>
                <span className="text-lg leading-tight text-zinc-300 md:text-xl lg:text-2xl">
                  Smart calendar scheduling
                </span>
              </li>
              <li className="flex items-center gap-4 lg:gap-5">
                <span className="inline-flex size-12 items-center justify-center rounded-2xl border border-teal-900/45 bg-teal-950/25 text-teal-600 lg:size-14">
                  <Users className="size-6 lg:size-7" aria-hidden />
                </span>
                <span className="text-lg leading-tight text-zinc-300 md:text-xl lg:text-2xl">
                  Team collaboration tools
                </span>
              </li>
              <li className="flex items-center gap-4 lg:gap-5">
                <span className="inline-flex size-12 items-center justify-center rounded-2xl border border-teal-900/45 bg-teal-950/25 text-teal-600 lg:size-14">
                  <Clock3 className="size-6 lg:size-7" aria-hidden />
                </span>
                <span className="text-lg leading-tight text-zinc-300 md:text-xl lg:text-2xl">
                  Real-time availability sync
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden  bg-zinc-50/95 p-7 dark:bg-zinc-950/85">
        {mode === "login" ? (
          <LoginForm
            onSuccess={goApp}
            onRequestRegister={() => setMode("register")}
          />
        ) : (
          <RegisterForm
            onSuccess={goApp}
            onRequestLogin={() => setMode("login")}
          />
        )}
      </div>
    </main>
  );
}
