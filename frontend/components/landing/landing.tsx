import { SiteFooter } from "@/components/legal/site-footer";
import { SignedInRedirect } from "@/components/landing/signed-in-redirect";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  CalendarSync,
  Clock3,
  ListTodo,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";

const FEATURES = [
  {
    icon: CalendarDays,
    title: "Smart calendar scheduling",
    body: "Plan events and meetings on a day, week or month calendar, and drag tasks straight into free time.",
  },
  {
    icon: ListTodo,
    title: "Tasks and events in one place",
    body: "Track tasks with due dates, priorities and reminders next to the events they belong to.",
  },
  {
    icon: Users,
    title: "Team collaboration tools",
    body: "Invite guests to events and tasks, and see who has accepted.",
  },
  {
    icon: Clock3,
    title: "Real-time availability sync",
    body: "Overlapping events are flagged so double bookings are caught early.",
  },
];

export function Landing() {
  return (
    <div className="flex min-h-dvh flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <SignedInRedirect />

      <header className="px-4 py-5">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="text-xl font-semibold text-teal-700 dark:text-teal-400">
            Eventra
          </span>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 px-4">
        <section className="mx-auto max-w-5xl py-14 sm:py-20">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Eventra
          </h1>
          <p className="mt-3 text-xl text-zinc-700 sm:text-2xl dark:text-zinc-300">
            Schedule work together.
          </p>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
            Eventra is a calendar and task-management app. It lets you and
            your team schedule events, tasks and meetings in one workspace,
            and it can sync with your Google Calendar so your Google events
            appear alongside your Eventra plans.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="h-11 rounded-xl px-6 text-base">
              <Link href="/login">Get started</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 rounded-xl px-6 text-base"
            >
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </section>

        <section
          aria-labelledby="features-heading"
          className="mx-auto max-w-5xl pb-14"
        >
          <h2 id="features-heading" className="text-2xl font-semibold">
            What you can do with Eventra
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li
                key={title}
                className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <Icon
                  className="size-6 text-teal-600 dark:text-teal-400"
                  aria-hidden
                />
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="google-heading"
          className="mx-auto max-w-5xl pb-20"
        >
          <div className="rounded-2xl border border-teal-200 bg-teal-50 p-6 dark:border-teal-900/60 dark:bg-teal-950/30">
            <div className="flex items-center gap-3">
              <CalendarSync
                className="size-6 text-teal-700 dark:text-teal-400"
                aria-hidden
              />
              <h2 id="google-heading" className="text-xl font-semibold">
                How Eventra uses Google Calendar
              </h2>
            </div>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              <li>
                Connecting Google Calendar is optional. You can use Eventra
                without it.
              </li>
              <li>
                When you connect it, Eventra reads events from your primary
                Google Calendar to show them in your Eventra calendar, and keeps
                them in sync when they change.
              </li>
              <li>
                If you turn on &quot;Add new Eventra events to Google
                Calendar&quot;, Eventra creates those events in your primary
                Google Calendar.
              </li>
              <li>
                If you ask the Eventra AI assistant about your schedule, the
                events it needs to answer (which can include events imported
                from Google Calendar) are sent to Google&apos;s Gemini API to
                write the reply.
              </li>
              <li>
                Your Google data is used only to provide these features. It is
                never sold, never shared with advertisers, and Eventra does not
                use it to train AI models.
              </li>
              <li>
                You can disconnect at any time in Settings. Eventra then revokes
                its access and deletes the stored tokens.
              </li>
            </ul>
            <p className="mt-4 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <ShieldCheck className="size-4 shrink-0" aria-hidden />
              <span>
                Read the full{" "}
                <Link
                  href="/privacy"
                  className="font-medium underline underline-offset-2"
                >
                  Privacy Policy
                </Link>
                .
              </span>
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
