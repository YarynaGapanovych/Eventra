"use client";

import { Search, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { NotificationsCenter } from "@/components/notifications-center";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

function HeaderSearchSkeleton() {
  return (
    <div
      className="h-9 min-w-0 flex-1 max-w-md rounded-lg bg-zinc-100/90 dark:bg-zinc-800/80"
      aria-hidden
    />
  );
}

function HeaderSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- keep field in sync with ?q when route changes */
    if (pathname === "/tasks") {
      setValue(searchParams.get("q") ?? "");
    } else {
      setValue("");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [pathname, searchParams]);

  useEffect(() => {
    if (pathname !== "/tasks") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      const trimmed = value.trim();
      const current = (searchParams.get("q") ?? "").trim();
      if (trimmed === current) return;
      const p = new URLSearchParams(searchParams.toString());
      if (trimmed) p.set("q", trimmed);
      else p.delete("q");
      const qs = p.toString();
      router.replace(qs ? `/tasks?${qs}` : "/tasks", { scroll: false });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, pathname, router, searchParams]);

  function commitToTasks(trimmed: string) {
    if (pathname === "/tasks") {
      const p = new URLSearchParams(searchParams.toString());
      if (trimmed) p.set("q", trimmed);
      else p.delete("q");
      const qs = p.toString();
      router.replace(qs ? `/tasks?${qs}` : "/tasks", { scroll: false });
    } else {
      router.push(
        trimmed ? `/tasks?q=${encodeURIComponent(trimmed)}` : "/tasks",
      );
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    commitToTasks(value.trim());
  }

  return (
    <form
      role="search"
      onSubmit={onSubmit}
      className="mx-auto min-w-0 w-full max-w-md sm:mx-0"
    >
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
          aria-hidden
        />
        <Input
          type="search"
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search tasks…"
          autoComplete="off"
          aria-label="Search tasks"
          className={cn(
            "h-9 w-full min-w-0 border-zinc-200 bg-white/90 pl-9 pr-3 text-sm dark:border-zinc-700 dark:bg-zinc-950/80",
            "[&::-webkit-search-cancel-button]:cursor-pointer",
          )}
        />
      </div>
    </form>
  );
}

function userDisplayName(user: {
  name: string | null;
  email: string;
}): string {
  return (
    user.name?.trim() ||
    user.email.split("@")[0]?.trim() ||
    user.email
  );
}

function AccountMenu() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function handleLogout() {
    logout();
    setOpen(false);
    router.replace("/");
  }

  return (
    <div ref={menuRef} className="relative shrink-0">
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={user ? `Account menu for ${userDisplayName(user)}` : "Account menu"}
        className="text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        onClick={() => setOpen((prev) => !prev)}
      >
        <User className="size-[22px]" aria-hidden strokeWidth={2} />
      </Button>
      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="absolute top-full right-0 z-60 mt-1.5 min-w-48 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-950"
        >
          {user ? (
            <div className="space-y-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {userDisplayName(user)}
                </p>
                <p
                  className="truncate text-xs text-zinc-500 dark:text-zinc-400"
                  title={user.email}
                >
                  {user.email}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                role="menuitem"
                className="w-full min-w-0 border-zinc-200 bg-white shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                onClick={handleLogout}
              >
                Logout
              </Button>
            </div>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Not signed in
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-zinc-200/80 bg-white/85 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/85">
      <div className="flex h-14 max-w-[100vw] items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <Link
          href="/calendar"
          className="shrink-0 text-base font-semibold uppercase tracking-[0.14em] text-teal-700 transition-colors hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300"
          aria-label="Eventra home"
        >
          Eventra
        </Link>

        <Suspense fallback={<HeaderSearchSkeleton />}>
          <HeaderSearch />
        </Suspense>

        <nav
          className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3"
          aria-label="Account"
        >
          <NotificationsCenter />
          <AccountMenu />
        </nav>
      </div>
    </header>
  );
}
