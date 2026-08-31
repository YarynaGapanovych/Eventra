import { AppAuthGate } from "@/components/app-auth-gate";
import { AppBottomNav } from "@/components/app-bottom-nav";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AppAuthGate>
      <div className="flex h-dvh w-full flex-col overflow-hidden bg-linear-to-br from-zinc-100 via-white to-teal-50/40 dark:from-zinc-950 dark:via-zinc-950 dark:to-teal-950/20">
        <SiteHeader />

        <div className="flex min-h-0 flex-1">
          <AppSidebar />

          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6 md:p-8">
            {children}
          </main>
        </div>

        <AppBottomNav />
      </div>
    </AppAuthGate>
  );
}
