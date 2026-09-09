export const UPDATE_GOOGLE_CALENDAR_EXPORT_SETTING_MUTATION = `
  mutation UpdateGoogleCalendarExportSetting($exportEventraEvents: Boolean!) {
    updateGoogleCalendarExportSetting(
      exportEventraEvents: $exportEventraEvents
    ) {
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
