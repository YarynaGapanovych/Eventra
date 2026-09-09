export const SYNC_GOOGLE_CALENDAR_MUTATION = `
  mutation SyncGoogleCalendar($incremental: Boolean) {
    syncGoogleCalendar(incremental: $incremental) {
      ok
      syncedAt
      imported
      changed
      overlaps {
        id
        title
        overlappingTitles
        start
        end
      }
    }
  }
`;
