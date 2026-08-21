import { graphqlRequest } from "@/lib/graphql";
import { ASK_ASSISTANT_MUTATION } from "@/lib/graphql/mutations";
import { queryKeys } from "@/lib/query-keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export type AssistantChatRole = "user" | "assistant";

export type AssistantChatMessage = {
  role: AssistantChatRole;
  content: string;
};

export type AssistantReply = {
  content: string;
  didMutate: boolean;
};

export function useAskAssistant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (messages: AssistantChatMessage[]) => {
      const data = await graphqlRequest<{ askAssistant: AssistantReply }>(
        ASK_ASSISTANT_MUTATION,
        { messages },
      );
      return data.askAssistant;
    },
    onSuccess: (reply) => {
      if (!reply.didMutate) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
      void queryClient.invalidateQueries({ queryKey: queryKeys.events });
    },
  });
}
