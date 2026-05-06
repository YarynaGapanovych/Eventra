import { HomeAuth } from "@/components/home-auth";
import { Cormorant_Garamond } from "next/font/google";

const logo = Cormorant_Garamond({
  weight: "600",
  subsets: ["latin"],
  display: "swap",
});

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-col bg-linear-to-br from-zinc-100 via-white to-teal-50/50 dark:from-zinc-950 dark:via-zinc-950 dark:to-teal-950/25">
      <header className="border-b border-zinc-200/80 bg-white/70 px-4 py-3 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/75 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <span
            className={`${logo.className} text-xl tracking-[0.12em] text-zinc-900 sm:text-2xl dark:text-zinc-50`}
            style={{ fontFeatureSettings: '"liga" 1, "kern" 1' }}
          >
            EVENTRA
          </span>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 md:py-16">
        <HomeAuth />
      </main>
    </div>
  );
}
