import { SiteFooter } from "@/components/legal/site-footer";
import Link from "next/link";
import type { ReactNode } from "react";

export const LEGAL_LAST_UPDATED = "November 4, 2026";

/** Support address shown on the legal pages; must match the OAuth Branding support email. */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || null;

export function SupportContact() {
  return SUPPORT_EMAIL ? (
    <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium underline underline-offset-2">
      {SUPPORT_EMAIL}
    </a>
  ) : (
    <>the support email listed on Eventra&apos;s Google sign-in screen</>
  );
}

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="px-4 py-5">
        <div className="mx-auto max-w-3xl">
          <Link href="/" className="text-xl font-semibold text-teal-700 dark:text-teal-400">
            Eventra
          </Link>
        </div>
      </header>
      <main className="flex-1 px-4 pb-16">
        <article className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Last updated {LEGAL_LAST_UPDATED}
          </p>
          <div className="mt-8 space-y-8 leading-relaxed text-zinc-700 dark:text-zinc-300 [&_a]:text-teal-700 dark:[&_a]:text-teal-400 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-zinc-900 dark:[&_h2]:text-zinc-100 [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
            {children}
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
