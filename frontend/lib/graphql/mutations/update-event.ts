import { EVENT_SELECTION } from "@/lib/graphql/fragments";

export const UPDATE_EVENT_MUTATION = `
  mutation UpdateEvent($id: String!, $input: UpdateEventInput!) {
    updateEvent(id: $id, input: $input) {
      ${EVENT_SELECTION}
    }
  }
`;
