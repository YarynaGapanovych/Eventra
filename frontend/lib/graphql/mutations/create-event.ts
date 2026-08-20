import { EVENT_SELECTION } from "@/lib/graphql/fragments";

export const CREATE_EVENT_MUTATION = `
  mutation CreateEvent($input: CreateEventInput!) {
    createEvent(input: $input) {
      ${EVENT_SELECTION}
    }
  }
`;
