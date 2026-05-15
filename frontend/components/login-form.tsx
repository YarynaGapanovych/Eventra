"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLoginMutation } from "@/hooks/use-auth-mutations";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { z } from "zod/v3";

const loginFormSchema = z.object({
  email: z.string().trim().min(1, "Enter email.").email("Enter a valid email."),
  password: z.string().min(1, "Enter password."),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

type LoginFormProps = {
  onSuccess: () => void;
  onRequestRegister: () => void;
};

export function LoginForm({ onSuccess, onRequestRegister }: LoginFormProps) {
  const login = useLoginMutation();
  const { register, handleSubmit, setError, clearErrors, formState } =
    useForm<LoginFormValues>({
      resolver: zodResolver(loginFormSchema),
      defaultValues: { email: "", password: "" },
    });

  async function onValid(values: LoginFormValues) {
    clearErrors("root");
    try {
      await login.mutateAsync({
        email: values.email.trim(),
        password: values.password,
      });
      onSuccess();
    } catch (err) {
      setError("root", {
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  }

  return (
    <form
      className="mx-auto flex h-full w-full max-w-2xl flex-col justify-center gap-7"
      onSubmit={(e) => void handleSubmit(onValid)(e)}
    >
      <header className="space-y-3">
        <h2 className="text-4xl font-semibold tracking-tight text-zinc-900 md:text-5xl dark:text-zinc-50">
          Welcome back
        </h2>
        <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          Sign in to manage your schedule and team calendar.
        </p>
      </header>

      <div className="space-y-2.5">
        <Label
          htmlFor="auth-email"
          className="text-lg font-medium text-zinc-900 dark:text-zinc-100"
        >
          Email address
        </Label>
        <Input
          id="auth-email"
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

      <div className="space-y-2.5">
        <Label
          htmlFor="auth-password"
          className="text-lg font-medium text-zinc-900 dark:text-zinc-100"
        >
          Password
        </Label>
        <Input
          id="auth-password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!formState.errors.password}
          placeholder="Enter your password"
          className="h-14 rounded-xl border-zinc-300 bg-white px-4 text-lg shadow-sm transition-all focus-visible:ring-4 focus-visible:ring-teal-500/15 dark:border-zinc-700 dark:bg-zinc-900"
          {...register("password")}
        />
        {formState.errors.password ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {formState.errors.password.message}
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
        disabled={login.isPending}
      >
        {login.isPending ? (
          "Please wait…"
        ) : (
          <span className="inline-flex items-center gap-2">
            Sign in
            <ArrowRight className="size-4" aria-hidden />
          </span>
        )}
      </Button>

      <div className="pt-2">
        <div className="flex items-center gap-3 text-sm uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          <span className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
          Or continue with
          <span className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-13 w-full rounded-xl border-zinc-300 bg-white text-lg text-zinc-800 shadow-sm hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <Image src="/icons8-google.svg" alt="Google" width={18} height={18} />
          Google
        </Button>
      </div>

      <div className="space-y-5 pt-2">
        <p className="text-center text-base text-zinc-600 dark:text-zinc-400">
          Don&apos;t have an account?{" "}
          <Button
            type="button"
            variant="link"
            className="h-auto min-h-0 px-0.5 py-0 font-semibold text-teal-700 underline-offset-4 hover:underline dark:text-teal-400"
            onClick={() => {
              clearErrors("root");
              onRequestRegister();
            }}
          >
            Create one
          </Button>
        </p>

        <p className="text-center text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          By signing in, you agree to our{" "}
          <a className="underline underline-offset-2" href="#">
            Terms of Service
          </a>{" "}
          and{" "}
          <a className="underline underline-offset-2" href="#">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </form>
  );
}
