export const START_GOOGLE_CALENDAR_CONNECT_MUTATION = `
  mutation StartGoogleCalendarConnect($input: StartGoogleCalendarConnectInput) {
    startGoogleCalendarConnect(input: $input) {
      connectUrl
    }
  }
`;
