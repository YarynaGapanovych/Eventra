"use client";

import { appNavItems, isAppNavActive } from "@/components/app-nav-items";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="shrink-0 border-t border-zinc-200/80 bg-white/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden dark:border-zinc-800 dark:bg-zinc-950/92"
      aria-label="Main navigation"
    >
      <div className="grid grid-cols-4">
        {appNavItems.map(({ href, label, Icon }) => {
          const active = isAppNavActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium transition-colors",
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
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
