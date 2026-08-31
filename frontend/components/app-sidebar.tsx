"use client";

import { appNavItems, isAppNavActive } from "@/components/app-nav-items";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useState } from "react";

const STORAGE_KEY = "eventra.sidebar.collapsed.v1";

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
        "hidden min-h-0 flex-col overflow-hidden border-r border-zinc-200/80 bg-white/92 backdrop-blur-md transition-[width] duration-200 ease-out md:flex dark:border-zinc-800 dark:bg-zinc-950/92",
        rail ? "w-16" : "w-56 sm:w-60",
      )}
      aria-label="Main navigation"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden p-2 pt-3">
        <nav
          id="app-sidebar-nav"
          className="flex flex-col gap-0.5"
          aria-label="App sections"
        >
          {appNavItems.map(({ href, label, Icon }) => {
            const active = isAppNavActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                title={rail ? label : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex w-full items-center rounded-lg text-sm font-medium transition-colors",
                  rail ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                  active
                    ? "bg-teal-100 text-teal-900 dark:bg-teal-950/60 dark:text-teal-50"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50",
                )}
              >
                <Icon
                  className="size-5 shrink-0 opacity-90"
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
