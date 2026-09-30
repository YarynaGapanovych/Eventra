"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useResetPasswordMutation } from "@/hooks/use-auth-mutations";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v3";

const resetPasswordFormSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirm: z.string().min(1, "Confirm your password."),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwords do not match.",
    path: ["confirm"],
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;

type ResetPasswordFormProps = {
  onRequestLogin: () => void;
  token?: string | null;
};

export function ResetPasswordForm({
  onRequestLogin,
  token,
}: ResetPasswordFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const resetPassword = useResetPasswordMutation();
  const { register, handleSubmit, setError, clearErrors, formState } =
    useForm<ResetPasswordFormValues>({
      resolver: zodResolver(resetPasswordFormSchema),
      defaultValues: { password: "", confirm: "" },
    });

  async function onValid(values: ResetPasswordFormValues) {
    clearErrors("root");
    const resetToken = token?.trim();
    if (!resetToken) {
      setError("root", {
        message: "Invalid or expired reset link",
      });
      return;
    }
    try {
      await resetPassword.mutateAsync({
        token: resetToken,
        password: values.password,
      });
      setSubmitted(true);
    } catch (err) {
      setError("root", {
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-7">
        <header className="space-y-3">
          <h2 className="text-4xl font-semibold tracking-tight text-zinc-900 md:text-5xl dark:text-zinc-50">
            Password updated
          </h2>
          <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
            Your password has been changed. Sign in with your new password.
          </p>
        </header>

        <Button
          type="button"
          className="h-14 w-full rounded-xl bg-teal-700 text-lg font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-teal-800 hover:shadow-md dark:bg-teal-600 dark:hover:bg-teal-500"
          onClick={onRequestLogin}
        >
          <span className="inline-flex items-center gap-2">
            Sign in
            <ArrowRight className="size-4" aria-hidden />
          </span>
        </Button>
      </div>
    );
  }

  return (
    <form
      className="mx-auto flex w-full max-w-2xl flex-col gap-7"
      onSubmit={(e) => void handleSubmit(onValid)(e)}
    >
      <header className="space-y-3">
        <h2 className="text-4xl font-semibold tracking-tight text-zinc-900 md:text-5xl dark:text-zinc-50">
          Set a new password
        </h2>
        <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          Choose a new password for your account.
        </p>
      </header>

      <div className="space-y-2.5">
        <Label
          htmlFor="reset-password"
          className="text-lg font-medium text-zinc-900 dark:text-zinc-100"
        >
          Password
        </Label>
        <Input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!formState.errors.password}
          placeholder="Create a password"
          className="h-14 rounded-xl border-zinc-300 bg-white px-4 text-lg shadow-sm transition-all focus-visible:ring-4 focus-visible:ring-teal-500/15 dark:border-zinc-700 dark:bg-zinc-900"
          {...register("password")}
        />
        {!formState.errors.password ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Must be at least 8 characters
          </p>
        ) : null}
        {formState.errors.password ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {formState.errors.password.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2.5">
        <Label
          htmlFor="reset-confirm"
          className="text-lg font-medium text-zinc-900 dark:text-zinc-100"
        >
          Confirm password
        </Label>
        <Input
          id="reset-confirm"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!formState.errors.confirm}
          placeholder="Confirm your password"
          className="h-14 rounded-xl border-zinc-300 bg-white px-4 text-lg shadow-sm transition-all focus-visible:ring-4 focus-visible:ring-teal-500/15 dark:border-zinc-700 dark:bg-zinc-900"
          {...register("confirm")}
        />
        {formState.errors.confirm ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {formState.errors.confirm.message}
          </p>
        ) : null}
      </div>

      {formState.errors.root ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          {formState.errors.root.message}
        </p>
      ) : null}

      <Button
        type="submit"
        className="h-14 w-full rounded-xl bg-teal-700 text-lg font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-teal-800 hover:shadow-md dark:bg-teal-600 dark:hover:bg-teal-500"
        disabled={resetPassword.isPending}
      >
        {resetPassword.isPending ? (
          "Please wait…"
        ) : (
          <span className="inline-flex items-center gap-2">
            Update password
            <ArrowRight className="size-4" aria-hidden />
          </span>
        )}
      </Button>
    </form>
  );
}
