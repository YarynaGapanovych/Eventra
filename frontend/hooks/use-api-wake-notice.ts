import { fetchApiHealth } from "@/lib/api-health";
import { queryKeys } from "@/lib/query-keys";
import { useIsClient } from "@/hooks/use-is-client";
import {
  useIsFetching,
  useQuery,
  useQueryClient,
  type Query,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";

const NOTICE_DELAY_MS = 2000;

export const FREE_HOSTING_WAKE_MESSAGE =
  "This app runs on free hosting, so the server and database may take a minute to wake up. Your calendar is loading — it is not empty.";

function isCalendarQuery(query: Query): boolean {
  const root = query.queryKey[0];
  return root === queryKeys.events[0] || root === queryKeys.tasks[0];
}

function calendarQueriesWaiting(
  queryClient: ReturnType<typeof useQueryClient>,
): boolean {
  const queries = queryClient.getQueryCache().findAll({
    predicate: isCalendarQuery,
  });
  if (queries.length === 0) return false;
  return queries.some(
    (query) =>
      query.state.data === undefined &&
      query.state.status !== "error" &&
      (query.state.fetchStatus === "fetching" ||
        query.state.status === "pending"),
  );
}

function useApiHealthQuery() {
  const isClient = useIsClient();
  return useQuery({
    queryKey: queryKeys.apiHealth,
    queryFn: fetchApiHealth,
    enabled: isClient,
    retry: 10,
    retryDelay: (attempt) => Math.min(2000 * 2 ** attempt, 15_000),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useApiWakeNotice() {
  const health = useApiHealthQuery();
  const queryClient = useQueryClient();
  const calendarFetching = useIsFetching({ predicate: isCalendarQuery });
  const [delayElapsed, setDelayElapsed] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setDelayElapsed(true), NOTICE_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  const waitingOnHealth = health.isPending;
  const waitingOnCalendar =
    calendarFetching > 0 && calendarQueriesWaiting(queryClient);
  const isWaking = waitingOnHealth || waitingOnCalendar;

  return {
    isWaking,
    showNotice: isWaking && delayElapsed,
  };
}
