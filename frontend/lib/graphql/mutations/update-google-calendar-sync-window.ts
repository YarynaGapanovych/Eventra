export const UPDATE_GOOGLE_CALENDAR_SYNC_WINDOW_MUTATION = `
  mutation UpdateGoogleCalendarSyncWindow(
    $input: UpdateGoogleCalendarSyncWindowInput!
  ) {
    updateGoogleCalendarSyncWindow(input: $input) {
      connected
      connectedAt
      lastSyncedAt
      syncDaysBack
      syncDaysForward
    }
  }
`;
