"use client";

import { AuthSplitLayout } from "@/components/auth-split-layout";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  return (
    <AuthSplitLayout>
      <ResetPasswordForm
        token={token}
        onRequestLogin={() => router.replace("/")}
      />
    </AuthSplitLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
