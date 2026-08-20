import { getStoredAuth } from "@/lib/auth-storage";
import { graphqlRequest } from "@/lib/graphql";
import {
  CREATE_EVENT_MUTATION,
  SCHEDULE_TASK_MUTATION,
  UPDATE_EVENT_MUTATION,
} from "@/lib/graphql/mutations";
import { EVENTS_QUERY } from "@/lib/graphql/queries";
import { queryKeys } from "@/lib/query-keys";
import {
  buildMockEvents,
  buildMockTasks,
  isMockEventId,
} from "@/lib/mock-tasks";
import {
  normalizeApiEvent,
  type ApiEvent,
  type CreateEventInput,
  type ScheduleTaskInput,
  type UpdateEventInput,
} from "@/lib/events-api";
import { tasksUseMocks } from "@/lib/tasks-api";
import { useAuthStore } from "@/stores/auth-store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsClient } from "@/hooks/use-is-client";

async function fetchEvents(): Promise<ApiEvent[]> {
  const useMocks = tasksUseMocks();
  const hasToken = Boolean(getStoredAuth()?.token);
  if (useMocks && !hasToken) {
    return buildMockEvents(buildMockTasks());
  }
  const data = await graphqlRequest<{ events: ApiEvent[] }>(EVENTS_QUERY);
  return data.events.map(normalizeApiEvent);
}

export function useEventsQuery(options?: { refetchInterval?: number }) {
  const token = useAuthStore((s) => s.token);
  const isClient = useIsClient();
  return useQuery({
    queryKey: [...queryKeys.events, token ?? "anon"],
    queryFn: fetchEvents,
    refetchInterval: options?.refetchInterval,
    enabled: isClient,
  });
}

function invalidateCalendar(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.events });
  void queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
}

export function useCreateEventMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateEventInput) => {
      const data = await graphqlRequest<{ createEvent: ApiEvent }>(
        CREATE_EVENT_MUTATION,
        { input },
      );
      return normalizeApiEvent(data.createEvent);
    },
    onSuccess: () => invalidateCalendar(queryClient),
  });
}

export function useUpdateEventMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateEventInput;
    }) => {
      if (isMockEventId(id)) {
        return {
          id,
          title: input.title ?? "",
          start: input.start ?? "",
          end: input.end ?? "",
          source: "eventra" as const,
          googleEventId: null,
          taskId: null,
        };
      }
      const data = await graphqlRequest<{ updateEvent: ApiEvent }>(
        UPDATE_EVENT_MUTATION,
        { id, input },
      );
      return normalizeApiEvent(data.updateEvent);
    },
    onSuccess: () => invalidateCalendar(queryClient),
  });
}

export function useScheduleTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ScheduleTaskInput) => {
      const data = await graphqlRequest<{ scheduleTask: ApiEvent }>(
        SCHEDULE_TASK_MUTATION,
        { input },
      );
      return normalizeApiEvent(data.scheduleTask);
    },
    onSuccess: () => invalidateCalendar(queryClient),
  });
}
