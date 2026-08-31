"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRegisterMutation } from "@/hooks/use-auth-mutations";
import { startGoogleLogin } from "@/lib/google-auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { z } from "zod/v3";

const registerFormSchema = z
  .object({
    name: z.string(),
    email: z
      .string()
      .trim()
      .min(1, "Enter email.")
      .email("Enter a valid email."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirm: z.string().min(1, "Confirm your password."),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwords do not match.",
    path: ["confirm"],
  });

type RegisterFormValues = z.infer<typeof registerFormSchema>;

type RegisterFormProps = {
  onSuccess: () => void;
  onRequestLogin: () => void;
};

export function RegisterForm({ onSuccess, onRequestLogin }: RegisterFormProps) {
  const registerMutation = useRegisterMutation();
  const { register, handleSubmit, setError, clearErrors, formState } =
    useForm<RegisterFormValues>({
      resolver: zodResolver(registerFormSchema),
      defaultValues: {
        name: "",
        email: "",
        password: "",
        confirm: "",
      },
    });

  async function onValid(values: RegisterFormValues) {
    clearErrors("root");
    try {
      await registerMutation.mutateAsync({
        email: values.email.trim(),
        password: values.password,
        name: values.name.trim() || undefined,
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
      className="mx-auto flex w-full max-w-2xl flex-col gap-4"
      onSubmit={(e) => void handleSubmit(onValid)(e)}
    >
      <header className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl dark:text-zinc-50">
          Create your account
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          Start organizing your schedule today.
        </p>
      </header>

      <div className="space-y-2">
        <Label
          htmlFor="reg-name"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Full name
        </Label>
        <Input
          id="reg-name"
          type="text"
          autoComplete="name"
          placeholder="Enter your name"
          className="h-12 rounded-xl border-zinc-300 bg-white px-4 text-base shadow-sm transition-all focus-visible:ring-4 focus-visible:ring-teal-500/15 dark:border-zinc-700 dark:bg-zinc-900"
          {...register("name")}
        />
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="reg-email"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Email address
        </Label>
        <Input
          id="reg-email"
          type="email"
          autoComplete="email"
          aria-invalid={!!formState.errors.email}
          placeholder="you@company.com"
          className="h-12 rounded-xl border-zinc-300 bg-white px-4 text-base shadow-sm transition-all focus-visible:ring-4 focus-visible:ring-teal-500/15 dark:border-zinc-700 dark:bg-zinc-900"
          {...register("email")}
        />
        {formState.errors.email ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {formState.errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="reg-password"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Password
        </Label>
        <Input
          id="reg-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!formState.errors.password}
          placeholder="Create a password"
          className="h-12 rounded-xl border-zinc-300 bg-white px-4 text-base shadow-sm transition-all focus-visible:ring-4 focus-visible:ring-teal-500/15 dark:border-zinc-700 dark:bg-zinc-900"
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

      <div className="space-y-2">
        <Label
          htmlFor="auth-confirm"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Confirm password
        </Label>
        <Input
          id="auth-confirm"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!formState.errors.confirm}
          placeholder="Confirm your password"
          className="h-12 rounded-xl border-zinc-300 bg-white px-4 text-base shadow-sm transition-all focus-visible:ring-4 focus-visible:ring-teal-500/15 dark:border-zinc-700 dark:bg-zinc-900"
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
        className="h-12 w-full rounded-xl bg-teal-700 text-base font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-teal-800 hover:shadow-md dark:bg-teal-600 dark:hover:bg-teal-500"
        disabled={registerMutation.isPending}
      >
        {registerMutation.isPending ? (
          "Please wait…"
        ) : (
          <span className="inline-flex items-center gap-2">
            Create account
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
          className="h-12 w-full rounded-xl border-zinc-300 bg-white text-base text-zinc-800 shadow-sm hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          onClick={() => startGoogleLogin()}
        >
          <Image src="/icons8-google.svg" alt="Google" width={18} height={18} />
          Google
        </Button>
      </div>

      <div className="space-y-3 pt-1">
        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          Already have an account?{" "}
          <Button
            type="button"
            variant="link"
            className="h-auto min-h-0 px-0.5 py-0 font-semibold text-teal-700 underline-offset-4 hover:underline dark:text-teal-400"
            onClick={() => {
              clearErrors("root");
              onRequestLogin();
            }}
          >
            Sign in
          </Button>
        </p>

        <p className="text-center text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          By creating an account, you agree to our{" "}
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
