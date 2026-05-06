"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Cormorant_Garamond } from "next/font/google";
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useState } from "react";

const logo = Cormorant_Garamond({
  weight: "600",
  subsets: ["latin"],
  display: "swap",
});

const STORAGE_KEY = "eventra.sidebar.collapsed.v1";

const navItems = [
  { href: "/calendar", label: "Calendar", Icon: CalendarDays },
  { href: "/tasks", label: "Tasks", Icon: ClipboardList },
  { href: "/analytics", label: "Analytics", Icon: BarChart3 },
  { href: "/settings", label: "Settings", Icon: Settings },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useLayoutEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate rail width from localStorage */
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setCollapsed(true);
      else if (stored === "0") setCollapsed(false);
    } catch {
      /* ignore */
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  const rail = collapsed;

  return (
    <aside
      className={cn(
        "sticky top-0 z-40 flex h-[100dvh] shrink-0 flex-col border-r border-zinc-200/80 bg-white/92 backdrop-blur-md transition-[width] duration-200 ease-out dark:border-zinc-800 dark:bg-zinc-950/92",
        rail ? "w-[4.25rem]" : "w-56 sm:w-[15rem]",
      )}
      aria-label="Main navigation"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden p-2">
        <Link
          href="/calendar"
          title="Eventra — calendar home"
          className={cn(
            "flex shrink-0 items-center rounded-lg text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-900/80",
            rail ? "mb-2 h-11 justify-center" : "mb-3 px-3 py-2.5",
          )}
        >
          {rail ? (
            <span
              className={`${logo.className} text-lg tracking-[0.12em]`}
              style={{ fontFeatureSettings: '"liga" 1, "kern" 1' }}
            >
              E
            </span>
          ) : (
            <span
              className={`${logo.className} text-xl tracking-[0.14em]`}
              style={{ fontFeatureSettings: '"liga" 1, "kern" 1' }}
            >
              EVENTRA
            </span>
          )}
        </Link>

        <nav
          id="app-sidebar-nav"
          className="flex flex-col gap-0.5"
          aria-label="App sections"
        >
          {navItems.map(({ href, label, Icon }) => {
            const active =
              pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                title={rail ? label : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium transition-colors",
                  rail
                    ? "justify-center px-2 py-2.5"
                    : "gap-3 px-3 py-2.5",
                  active
                    ? "bg-teal-100 text-teal-900 dark:bg-teal-950/60 dark:text-teal-50"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50",
                )}
              >
                <Icon
                  className="size-[1.125rem] shrink-0 opacity-90"
                  strokeWidth={2}
                  aria-hidden
                />
                {!rail ? <span>{label}</span> : null}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="shrink-0 border-t border-zinc-200/80 bg-white/92 p-2 dark:border-zinc-800 dark:bg-zinc-950/92">
        <Button
          type="button"
          variant="ghost"
          size={rail ? "icon" : "sm"}
          className={cn(
            "w-full text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
            !rail && "justify-start gap-2 px-3",
          )}
          onClick={toggleCollapsed}
          aria-expanded={!rail}
          aria-controls="app-sidebar-nav"
          aria-label={rail ? "Expand sidebar" : "Collapse sidebar"}
        >
          {rail ? (
            <ChevronRight className="size-4" aria-hidden />
          ) : (
            <>
              <ChevronLeft className="size-4 shrink-0" aria-hidden />
              <span className="truncate">Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
