import { graphqlRequest } from "@/lib/graphql";
import {
  ASK_ASSISTANT_MUTATION,
  RESET_ASSISTANT_THREAD_MUTATION,
} from "@/lib/graphql/mutations";
import { ASSISTANT_THREAD_QUERY } from "@/lib/graphql/queries";
import { queryKeys } from "@/lib/query-keys";
import { useAuthStore } from "@/stores/auth-store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsClient } from "@/hooks/use-is-client";

export type AssistantChatRole = "user" | "assistant";

export type AssistantChatMessage = {
  id: string;
  role: AssistantChatRole;
  content: string;
  createdAt: string;
};

export type AssistantThread = {
  messages: AssistantChatMessage[];
  expiresAt: string | null;
};

export type AssistantReply = {
  content: string;
  didMutate: boolean;
};

function isChatRole(role: string): role is AssistantChatRole {
  return role === "user" || role === "assistant";
}

function normalizeThread(thread: {
  expiresAt: string | null;
  messages: {
    id: string;
    role: string;
    content: string;
    createdAt: string;
  }[];
}): AssistantThread {
  return {
    expiresAt: thread.expiresAt,
    messages: thread.messages.flatMap((message) =>
      isChatRole(message.role)
        ? [
            {
              id: message.id,
              role: message.role,
              content: message.content,
              createdAt: message.createdAt,
            },
          ]
        : [],
    ),
  };
}

export function useAssistantThreadQuery(options?: { enabled?: boolean }) {
  const token = useAuthStore((s) => s.token);
  const isClient = useIsClient();
  return useQuery({
    queryKey: [...queryKeys.assistantThread, token ?? "anon"],
    queryFn: async () => {
      const data = await graphqlRequest<{ assistantThread: AssistantThread }>(
        ASSISTANT_THREAD_QUERY,
      );
      return normalizeThread(data.assistantThread);
    },
    enabled: isClient && Boolean(token) && (options?.enabled ?? true),
  });
}

export function useAskAssistant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) => {
      const data = await graphqlRequest<{ askAssistant: AssistantReply }>(
        ASK_ASSISTANT_MUTATION,
        { content },
      );
      return data.askAssistant;
    },
    onSuccess: (reply) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.assistantThread,
      });
      if (!reply.didMutate) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
      void queryClient.invalidateQueries({ queryKey: queryKeys.events });
    },
  });
}

export function useResetAssistantThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const data = await graphqlRequest<{ resetAssistantThread: boolean }>(
        RESET_ASSISTANT_THREAD_MUTATION,
      );
      return data.resetAssistantThread;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.assistantThread,
      });
    },
  });
}
