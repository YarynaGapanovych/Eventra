"use client";

import { SettingsPanel } from "@/components/settings-panel";
import { GOOGLE_CALENDAR_SYNC_CHANGED_EVENT } from "@/lib/google-calendar-sync";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const status = searchParams.get("google_calendar");
    if (!status) return;

    if (status === "connected") {
      window.dispatchEvent(new Event(GOOGLE_CALENDAR_SYNC_CHANGED_EVENT));
    }

    const next = new URLSearchParams(searchParams.toString());
    next.delete("google_calendar");
    next.delete("message");
    const qs = next.toString();
    router.replace(qs ? `/settings?${qs}` : "/settings", { scroll: false });
  }, [searchParams, router]);

  return <SettingsPanel />;
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsPanel />}>
      <SettingsPageContent />
    </Suspense>
  );
}
