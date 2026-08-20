export const DELETE_EVENT_MUTATION = `
  mutation DeleteEvent($id: String!) {
    deleteEvent(id: $id)
  }
`;
