export const UPDATE_USER_SETTINGS_MUTATION = `
  mutation UpdateUserSettings($input: UpdateUserSettingsInput!) {
    updateUserSettings(input: $input) {
      workdayStart
      workdayEnd
      timezone
      defaultEventDurationMinutes
      showPastDoneTaskEvents
    }
  }
`;
