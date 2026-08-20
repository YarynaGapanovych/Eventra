export const CREATE_EVENT_MUTATION = `
  mutation CreateEvent($input: CreateEventInput!) {
    createEvent(input: $input) {
      id
      title
      start
      end
      source
      googleEventId
      color
      taskId
    }
  }
`;
