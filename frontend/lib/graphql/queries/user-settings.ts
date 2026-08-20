export const USER_SETTINGS_QUERY = `
  query UserSettings {
    userSettings {
      workdayStart
      workdayEnd
      timezone
      defaultEventDurationMinutes
      showPastDoneTaskEvents
    }
  }
`;
