export const SYNC_GOOGLE_CALENDAR_MUTATION = `
  mutation SyncGoogleCalendar {
    syncGoogleCalendar {
      ok
      syncedAt
      imported
    }
  }
`;
