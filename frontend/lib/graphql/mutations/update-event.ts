export const UPDATE_EVENT_MUTATION = `
  mutation UpdateEvent($id: String!, $input: UpdateEventInput!) {
    updateEvent(id: $id, input: $input) {
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
