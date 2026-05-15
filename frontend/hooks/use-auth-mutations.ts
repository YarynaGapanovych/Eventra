import { apiLogin, apiRegister } from "@/lib/auth-api";
import { useAuthStore } from "@/stores/auth-store";
import { useMutation } from "@tanstack/react-query";

export function useLoginMutation() {
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      apiLogin(email, password),
    onSuccess: setSession,
  });
}

export function useRegisterMutation() {
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: (input: { email: string; password: string; name?: string }) =>
      apiRegister(input),
    onSuccess: setSession,
  });
}
