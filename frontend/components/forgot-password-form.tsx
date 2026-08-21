"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRequestPasswordResetMutation } from "@/hooks/use-auth-mutations";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v3";

const forgotPasswordFormSchema = z.object({
  email: z.string().trim().min(1, "Enter email.").email("Enter a valid email."),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordFormSchema>;

type ForgotPasswordFormProps = {
  onRequestLogin: () => void;
};

export function ForgotPasswordForm({ onRequestLogin }: ForgotPasswordFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const requestReset = useRequestPasswordResetMutation();
  const { register, handleSubmit, setError, clearErrors, formState } =
    useForm<ForgotPasswordFormValues>({
      resolver: zodResolver(forgotPasswordFormSchema),
      defaultValues: { email: "" },
    });

  async function onValid(values: ForgotPasswordFormValues) {
    clearErrors("root");
    try {
      await requestReset.mutateAsync(values.email.trim());
      setSubmitted(true);
    } catch (err) {
      setError("root", {
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col justify-center gap-7">
        <header className="space-y-3">
          <h2 className="text-4xl font-semibold tracking-tight text-zinc-900 md:text-5xl dark:text-zinc-50">
            Check your email
          </h2>
          <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
            If an account exists for that address, we sent a reset link.
          </p>
        </header>

        <p className="text-center text-base text-zinc-600 dark:text-zinc-400">
          <Button
            type="button"
            variant="link"
            className="h-auto min-h-0 px-0.5 py-0 font-semibold text-teal-700 underline-offset-4 hover:underline dark:text-teal-400"
            onClick={onRequestLogin}
          >
            Back to sign in
          </Button>
        </p>
      </div>
    );
  }

  return (
    <form
      className="mx-auto flex h-full w-full max-w-2xl flex-col justify-center gap-7"
      onSubmit={(e) => void handleSubmit(onValid)(e)}
    >
      <header className="space-y-3">
        <h2 className="text-4xl font-semibold tracking-tight text-zinc-900 md:text-5xl dark:text-zinc-50">
          Forgot password
        </h2>
        <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          Enter your email and we&apos;ll send you a link to reset your
          password.
        </p>
      </header>

      <div className="space-y-2.5">
        <Label
          htmlFor="forgot-email"
          className="text-lg font-medium text-zinc-900 dark:text-zinc-100"
        >
          Email address
        </Label>
        <Input
          id="forgot-email"
          type="email"
          autoComplete="email"
          aria-invalid={!!formState.errors.email}
          placeholder="you@company.com"
          className="h-14 rounded-xl border-zinc-300 bg-white px-4 text-lg shadow-sm transition-all focus-visible:ring-4 focus-visible:ring-teal-500/15 dark:border-zinc-700 dark:bg-zinc-900"
          {...register("email")}
        />
        {formState.errors.email ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {formState.errors.email.message}
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
        disabled={requestReset.isPending}
      >
        {requestReset.isPending ? (
          "Please wait…"
        ) : (
          <span className="inline-flex items-center gap-2">
            Send reset link
            <ArrowRight className="size-4" aria-hidden />
          </span>
        )}
      </Button>

      <p className="text-center text-base text-zinc-600 dark:text-zinc-400">
        <Button
          type="button"
          variant="link"
          className="h-auto min-h-0 px-0.5 py-0 font-semibold text-teal-700 underline-offset-4 hover:underline dark:text-teal-400"
          onClick={onRequestLogin}
        >
          Back to sign in
        </Button>
      </p>
    </form>
  );
}
