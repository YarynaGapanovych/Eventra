export const GOOGLE_CALENDAR_STATUS_QUERY = `
  query GoogleCalendarStatus {
    googleCalendarStatus {
      connected
      connectedAt
      lastSyncedAt
      syncDaysBack
      syncDaysForward
      exportEventraEvents
      pendingOverlaps {
        id
        title
        overlappingTitles
        start
        end
      }
    }
  }
`;

