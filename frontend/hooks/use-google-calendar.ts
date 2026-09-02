import { graphqlRequest } from "@/lib/graphql";
import {
  ACKNOWLEDGE_GOOGLE_CALENDAR_OVERLAPS_MUTATION,
  DISCONNECT_GOOGLE_CALENDAR_MUTATION,
  START_GOOGLE_CALENDAR_CONNECT_MUTATION,
  SYNC_GOOGLE_CALENDAR_MUTATION,
  UPDATE_GOOGLE_CALENDAR_SYNC_WINDOW_MUTATION,
} from "@/lib/graphql/mutations";
import { GOOGLE_CALENDAR_STATUS_QUERY } from "@/lib/graphql/queries";
import {
  normalizeGoogleCalendarStatus,
  type GoogleCalendarSyncState,
} from "@/lib/google-calendar-sync";
import { queryKeys } from "@/lib/query-keys";
import { useAuthStore } from "@/stores/auth-store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

async function fetchGoogleCalendarStatus(): Promise<GoogleCalendarSyncState> {
  const data = await graphqlRequest<{
    googleCalendarStatus: Partial<GoogleCalendarSyncState>;
  }>(GOOGLE_CALENDAR_STATUS_QUERY);
  return normalizeGoogleCalendarStatus(data.googleCalendarStatus);
}

export function useGoogleCalendarStatusQuery() {
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);

  return useQuery({
    queryKey: [...queryKeys.googleCalendarStatus, token ?? "anon"],
    queryFn: fetchGoogleCalendarStatus,
    enabled: hydrated && Boolean(token),
  });
}

function useInvalidateCalendarAndTasks() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.googleCalendarStatus,
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
    void queryClient.invalidateQueries({ queryKey: queryKeys.events });
  };
}

export function useStartGoogleCalendarConnectMutation() {
  return useMutation({
    mutationFn: async () => {
      const redirectUri = `${window.location.origin}/settings?google_calendar=connected`;
      const data = await graphqlRequest<{
        startGoogleCalendarConnect: { connectUrl?: string };
      }>(START_GOOGLE_CALENDAR_CONNECT_MUTATION, {
        input: { redirectUri },
      });
      const connectUrl = data.startGoogleCalendarConnect.connectUrl;
      if (!connectUrl) {
        throw new Error("Connect URL missing from server response.");
      }
      window.location.href = connectUrl;
    },
  });
}

export function useDisconnectGoogleCalendarMutation() {
  const invalidate = useInvalidateCalendarAndTasks();
  return useMutation({
    mutationFn: async () => {
      await graphqlRequest(DISCONNECT_GOOGLE_CALENDAR_MUTATION);
    },
    onSuccess: invalidate,
  });
}

export function useSyncGoogleCalendarMutation() {
  const invalidate = useInvalidateCalendarAndTasks();
  return useMutation({
    mutationFn: async () => {
      const data = await graphqlRequest<{
        syncGoogleCalendar: { syncedAt?: string };
      }>(SYNC_GOOGLE_CALENDAR_MUTATION);
      return (
        data.syncGoogleCalendar.syncedAt ?? new Date().toISOString()
      );
    },
    onSuccess: invalidate,
  });
}

export function useAcknowledgeGoogleCalendarOverlapsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const data = await graphqlRequest<{
        acknowledgeGoogleCalendarOverlaps?: boolean;
      }>(ACKNOWLEDGE_GOOGLE_CALENDAR_OVERLAPS_MUTATION);
      return data.acknowledgeGoogleCalendarOverlaps === true;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.googleCalendarStatus,
      });
    },
  });
}

export function useUpdateGoogleCalendarSyncWindowMutation() {
  const invalidate = useInvalidateCalendarAndTasks();
  return useMutation({
    mutationFn: async (input: {
      syncDaysBack: number;
      syncDaysForward: number;
    }) => {
      const data = await graphqlRequest<{
        updateGoogleCalendarSyncWindow: Partial<GoogleCalendarSyncState>;
      }>(UPDATE_GOOGLE_CALENDAR_SYNC_WINDOW_MUTATION, { input });
      return normalizeGoogleCalendarStatus(
        data.updateGoogleCalendarSyncWindow,
      );
    },
    onSuccess: invalidate,
  });
}
