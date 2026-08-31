import { CalendarDays, Clock3, Users } from "lucide-react";
import type { ReactNode } from "react";

type AuthSplitLayoutProps = {
  children: ReactNode;
};

export function AuthSplitLayout({ children }: AuthSplitLayoutProps) {
  return (
    <main className="grid min-h-dvh w-full lg:h-dvh lg:grid-cols-2 lg:overflow-hidden">
      <div className="relative hidden h-full min-h-0 flex-col overflow-hidden bg-black px-12 py-12 text-left lg:flex xl:px-16 xl:py-14">
        <div className="pointer-events-none absolute -left-12 top-8 h-72 w-72 rounded-full border border-teal-700/35" />
        <div className="pointer-events-none absolute -right-30 top-28 h-132 w-132 rounded-full border border-teal-700/30" />
        <div className="pointer-events-none absolute -right-20 -bottom-28 h-96 w-96 rounded-full border border-teal-700/24" />
        <div className="pointer-events-none absolute left-28 -top-10 h-56 w-56 rounded-full border border-teal-600/28" />
        <div className="pointer-events-none absolute -left-24 bottom-14 h-80 w-80 rounded-full border border-teal-800/30" />
        <div className="pointer-events-none absolute right-20 top-10 h-40 w-40 rounded-full border border-teal-500/24" />
        <div className="pointer-events-none absolute left-44 bottom-16 h-52 w-52 rounded-full border border-teal-600/24" />
        <div className="pointer-events-none absolute -right-8 bottom-44 h-64 w-64 rounded-full border border-teal-700/24" />
        <div className="pointer-events-none absolute right-32 -bottom-8 h-44 w-44 rounded-full border border-teal-500/20" />

        <div className="relative z-10 flex h-full min-h-0 flex-col">
          <p className="shrink-0 text-3xl font-semibold leading-none uppercase tracking-[0.08em] text-teal-600 xl:text-4xl">
            Eventra
          </p>
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-5 overflow-y-auto xl:gap-8">
            <h1 className="text-3xl font-semibold leading-[0.95] tracking-tight text-balance text-zinc-100 xl:text-5xl">
              Schedule work together
            </h1>
            <p className="text-base leading-relaxed text-zinc-400 xl:text-lg">
              Coordinate seamlessly with your team. Manage calendars, tasks, and
              meetings in one unified workspace.
            </p>

            <ul className="space-y-3 xl:space-y-4">
              <li className="flex items-center gap-3 xl:gap-4">
                <span className="inline-flex size-10 items-center justify-center rounded-2xl border border-teal-900/45 bg-teal-950/25 text-teal-600 xl:size-11">
                  <CalendarDays className="size-5 xl:size-6" aria-hidden />
                </span>
                <span className="text-base leading-tight text-zinc-300 xl:text-lg">
                  Smart calendar scheduling
                </span>
              </li>
              <li className="flex items-center gap-3 xl:gap-4">
                <span className="inline-flex size-10 items-center justify-center rounded-2xl border border-teal-900/45 bg-teal-950/25 text-teal-600 xl:size-11">
                  <Users className="size-5 xl:size-6" aria-hidden />
                </span>
                <span className="text-base leading-tight text-zinc-300 xl:text-lg">
                  Team collaboration tools
                </span>
              </li>
              <li className="flex items-center gap-3 xl:gap-4">
                <span className="inline-flex size-10 items-center justify-center rounded-2xl border border-teal-900/45 bg-teal-950/25 text-teal-600 xl:size-11">
                  <Clock3 className="size-5 xl:size-6" aria-hidden />
                </span>
                <span className="text-base leading-tight text-zinc-300 xl:text-lg">
                  Real-time availability sync
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="relative flex min-h-dvh flex-col overflow-y-auto bg-zinc-50/95 px-5 py-8 dark:bg-zinc-950/85 lg:h-full lg:min-h-0 lg:p-7">
        <p className="mb-8 shrink-0 text-2xl font-semibold uppercase tracking-[0.08em] text-teal-600 lg:hidden">
          Eventra
        </p>
        <div className="flex flex-1 flex-col overflow-y-auto lg:min-h-0 lg:justify-center">
          {children}
        </div>
      </div>
    </main>
  );
}
