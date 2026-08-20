import { graphqlRequest } from "@/lib/graphql";
import { UPDATE_USER_SETTINGS_MUTATION } from "@/lib/graphql/mutations";
import { USER_SETTINGS_QUERY } from "@/lib/graphql/queries";
import {
  clearLegacyLocalSettings,
  normalizeSettingsPartial,
  takeLegacyLocalSettings,
  type AppSettings,
} from "@/lib/app-settings";
import { queryKeys } from "@/lib/query-keys";
import { useAuthStore } from "@/stores/auth-store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type UserSettingsPayload = {
  workdayStart: string;
  workdayEnd: string;
  timezone: string;
  defaultEventDurationMinutes: number;
  showPastDoneTaskEvents: boolean;
};

async function fetchUserSettings(): Promise<AppSettings> {
  const data = await graphqlRequest<{ userSettings: UserSettingsPayload }>(
    USER_SETTINGS_QUERY,
  );
  const server = normalizeSettingsPartial(data.userSettings);
  const legacy = takeLegacyLocalSettings();
  if (!legacy) return server;

  try {
    const updated = await graphqlRequest<{
      updateUserSettings: UserSettingsPayload;
    }>(UPDATE_USER_SETTINGS_MUTATION, { input: legacy });
    clearLegacyLocalSettings();
    return normalizeSettingsPartial(updated.updateUserSettings);
  } catch {
    return server;
  }
}

export function useUserSettingsQuery() {
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);

  return useQuery({
    queryKey: [...queryKeys.userSettings, token ?? "anon"],
    queryFn: fetchUserSettings,
    enabled: hydrated && Boolean(token),
  });
}

export function useUpdateUserSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AppSettings) => {
      const data = await graphqlRequest<{
        updateUserSettings: UserSettingsPayload;
      }>(UPDATE_USER_SETTINGS_MUTATION, { input });
      return normalizeSettingsPartial(data.updateUserSettings);
    },
    onSuccess: () => {
      clearLegacyLocalSettings();
      void queryClient.invalidateQueries({ queryKey: queryKeys.userSettings });
      void queryClient.invalidateQueries({ queryKey: queryKeys.events });
    },
  });
}
