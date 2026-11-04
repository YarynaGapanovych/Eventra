import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-200 px-4 py-8 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Eventra</p>
        <nav className="flex gap-5">
          <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-zinc-100">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-zinc-100">
            Terms of Service
          </Link>
          <Link href="/login" className="hover:text-zinc-900 dark:hover:text-zinc-100">
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}
