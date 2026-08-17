"use client";

import { SettingsPanel } from "@/components/settings-panel";
import { Suspense } from "react";

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsPanel />}>
      <SettingsPanel />
    </Suspense>
  );
}
