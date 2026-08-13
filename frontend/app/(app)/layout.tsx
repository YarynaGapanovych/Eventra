import { AppAuthGate } from "@/components/app-auth-gate";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-linear-to-br from-zinc-100 via-white to-teal-50/40 dark:from-zinc-950 dark:via-zinc-950 dark:to-teal-950/20">
      <SiteHeader />

      <div className="grid min-h-0 flex-1 grid-cols-[auto_minmax(0,1fr)]">
        <AppSidebar />

        <main className="flex min-h-0 flex-col overflow-y-auto p-4 sm:p-6 md:p-8">
          <AppAuthGate>{children}</AppAuthGate>
        </main>
      </div>
    </div>
  );
}
