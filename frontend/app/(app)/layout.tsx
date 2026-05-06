import { AppAuthGate } from "@/components/app-auth-gate";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-full flex-1 bg-linear-to-br from-zinc-100 via-white to-teal-50/40 dark:from-zinc-950 dark:via-zinc-950 dark:to-teal-950/20">
      <AppSidebar />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <SiteHeader />

        <main className="flex min-h-0 flex-1 flex-col p-4 sm:p-6 md:p-8">
          <AppAuthGate>{children}</AppAuthGate>
        </main>
      </div>
    </div>
  );
}
