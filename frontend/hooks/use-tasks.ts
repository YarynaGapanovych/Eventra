import { getStoredAuth } from "@/lib/auth-storage";
import { graphqlRequest } from "@/lib/graphql";
import {
  CREATE_TASK_MUTATION,
  UPDATE_TASK_MUTATION,
} from "@/lib/graphql/mutations";
import { TASKS_QUERY } from "@/lib/graphql/queries";
import { queryKeys } from "@/lib/query-keys";
import {
  buildMockTasks,
  normalizeApiTask,
  tasksUseMocks,
  type ApiTask,
  type CreateTaskInput,
  type UpdateTaskInput,
} from "@/lib/tasks-api";
import { useAuthStore } from "@/stores/auth-store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsClient } from "@/hooks/use-is-client";

async function fetchTasks(): Promise<ApiTask[]> {
  const useMocks = tasksUseMocks();
  const hasToken = Boolean(getStoredAuth()?.token);
  if (useMocks && !hasToken) {
    return buildMockTasks();
  }
  const data = await graphqlRequest<{ tasks: ApiTask[] }>(TASKS_QUERY);
  return data.tasks.map(normalizeApiTask);
}

export function useTasksQuery(options?: { refetchInterval?: number }) {
  const token = useAuthStore((s) => s.token);
  const isClient = useIsClient();
  return useQuery({
    queryKey: [...queryKeys.tasks, token ?? "anon"],
    queryFn: fetchTasks,
    refetchInterval: options?.refetchInterval,
    enabled: isClient,
  });
}

export function useCreateTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const data = await graphqlRequest<{ createTask: ApiTask }>(
        CREATE_TASK_MUTATION,
        { input },
      );
      return normalizeApiTask(data.createTask);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
      void queryClient.invalidateQueries({ queryKey: queryKeys.events });
    },
  });
}

export function useUpdateTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateTaskInput;
    }) => {
      const data = await graphqlRequest<{ updateTask: ApiTask }>(
        UPDATE_TASK_MUTATION,
        { id, input },
      );
      return normalizeApiTask(data.updateTask);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
      void queryClient.invalidateQueries({ queryKey: queryKeys.events });
    },
  });
}
